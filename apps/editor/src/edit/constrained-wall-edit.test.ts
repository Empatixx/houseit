import { applyCommand } from '@houseit/commands/run'
import { updateRoom } from '@houseit/commands/update-room'
import { updateWall } from '@houseit/commands/wall'
import { beforeEach, expect, test } from 'vitest'
import { previewStore } from '../store/preview'
import { documentStore } from '../store/store'
import { endPreview } from './preview'
import { moveWallBy, previewWallMove, previewWallResize, resizeWall } from './wall-commands'

beforeEach(() => {
  documentStore.getState().reset()
  endPreview()
})

function house() {
  documentStore
    .getState()
    .exec(
      [
        'add-room --shape rectangle --width 8000 --depth 6000 --name Room --material natural-oak',
        'add-opening --room Room --side west --kind window --width 1800',
      ].join('\n'),
    )
  const { doc } = documentStore.getState()
  const wall = Object.values(doc.walls).find(
    (w) => doc.nodes[w.a]!.y === 6000 && doc.nodes[w.b]!.y === 6000,
  )!
  return { doc, wall, room: Object.keys(doc.rooms)[0]! }
}

test.each(['room', 'wall'])(
  'a single overshooting %s drag previews and commits the true limit in one native undo step',
  (kind) => {
    const { doc, wall, room } = house()
    const roomId = kind === 'room' ? room : undefined
    const before = documentStore.getState()
    const graph = structuredClone(before.authoring.graph)
    previewWallMove(wall, { x: 0, y: -5500 }, roomId)
    const preview = previewStore.getState()
    expect(preview.refused).toBeNull()
    expect(preview.doc!.nodes[wall.a]!.y).toBe(3900)
    expect(documentStore.getState().doc).toBe(doc)
    expect(() => applyCommand(doc, updateRoom, { room, wall: wall.id, by: -2101 })).toThrow()
    expect(() =>
      documentStore.getState().exec(`update-room --room ${room} --wall ${wall.id} --by -5500`),
    ).toThrow()
    endPreview()
    expect(moveWallBy(wall, { x: 0, y: -5500 }, roomId)).toBe(true)
    expect(documentStore.getState().doc).toEqual(preview.doc)
    expect(documentStore.getState().past.length).toBe(before.past.length + 1)
    documentStore.getState().undo()
    expect(documentStore.getState().doc).toEqual(doc)
    expect(documentStore.getState().authoring.graph).toEqual(graph)
  },
)

test('the boundary is independent of the last pointer sample and releases when pulled back', () => {
  const { wall, room } = house()
  previewWallMove(wall, { x: 0, y: -1000 }, room)
  previewWallMove(wall, { x: 0, y: -9000 }, room)
  expect(previewStore.getState().doc!.nodes[wall.a]!.y).toBe(3900)
  previewWallMove(wall, { x: 0, y: -2000 }, room)
  expect(previewStore.getState().doc!.nodes[wall.a]!.y).toBe(4000)
  endPreview()
  expect(moveWallBy(wall, { x: 0, y: -2000 }, room)).toBe(true)
  expect(documentStore.getState().doc.nodes[wall.a]!.y).toBe(4000)
})

test('dragging farther at the limit keeps the document and native history unchanged', () => {
  const { wall, room } = house()
  moveWallBy(wall, { x: 0, y: -5500 }, room)
  const before = documentStore.getState()
  previewWallMove(before.doc.walls[wall.id]!, { x: 0, y: -4000 }, room)
  expect(previewStore.getState().doc).toBe(before.doc)
  endPreview()
  moveWallBy(before.doc.walls[wall.id]!, { x: 0, y: -4000 }, room)
  expect(documentStore.getState().doc).toBe(before.doc)
  expect(documentStore.getState().past).toEqual(before.past)
})

test('a free endpoint stops exactly where its hosted window still fits', () => {
  documentStore
    .getState()
    .exec(
      `add-wall --from '{"x":0,"y":0}' --to '{"x":5000,"y":0}'\nadd-opening --wall w1 --kind window --width 1000 --along 3500`,
    )
  const { doc } = documentStore.getState(),
    wall = doc.walls.w1!
  previewWallResize(wall, 'to', 10)
  const preview = previewStore.getState().doc!
  expect(preview.nodes[wall.b]!.x).toBe(4000)
  expect(() => applyCommand(doc, updateWall, { id: wall.id, end: 'to', length: 3999 })).toThrow()
  endPreview()
  expect(resizeWall(wall, 'to', 10)).toBe(true)
  expect(documentStore.getState().doc).toEqual(preview)
})
