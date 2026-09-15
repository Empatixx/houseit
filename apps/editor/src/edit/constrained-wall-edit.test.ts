import { readFileSync } from 'node:fs'
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

function steppedHouse() {
  documentStore
    .getState()
    .exec(
      [
        'add-room --shape rectangle --width 12000 --depth 8000 --name Hall --material natural-oak',
        'add-room --from Hall --side west --width 5000 --name Living --material natural-oak',
        'add-room --from Hall --side east --width 5500 --name Study --material natural-oak',
      ].join('\n'),
    )
  const { doc } = documentStore.getState()
  const north = (name: string) =>
    Object.values(doc.rooms)
      .find((r) => r.name === name)!
      .loop.find(
        (id) => doc.nodes[doc.walls[id]!.a]!.y === 8000 && doc.nodes[doc.walls[id]!.b]!.y === 8000,
      )!
  documentStore
    .getState()
    .exec(
      `update-room --room Living --wall ${north('Living')} --by 151\nupdate-room --room Study --wall ${north('Study')} --by 151`,
    )
  return north
}

test.each(['room', 'wall'])(
  'a %s drag can raise the corridor through an invalid short-return interval',
  (kind) => {
    const north = steppedHouse()
    const before = documentStore.getState(),
      wall = before.doc.walls[north('Hall')]!
    const room = Object.values(before.doc.rooms).find((r) => r.name === 'Hall')!.id
    const picked = kind === 'room' ? room : undefined
    for (const y of [151, 200, 300]) {
      previewWallMove(wall, { x: 0, y }, picked)
      const doc = previewStore.getState().doc!
      expect(doc.nodes[doc.walls[wall.id]!.a]!.y).toBe(8151)
      expect(doc.nodes[doc.walls[wall.id]!.b]!.y).toBe(8151)
    }
    const preview = previewStore.getState().doc
    endPreview()
    moveWallBy(wall, { x: 0, y: 300 }, picked)
    expect(documentStore.getState().doc).toEqual(preview)
    expect(documentStore.getState().past.length).toBe(before.past.length + 1)
    documentStore.getState().undo()
    expect(documentStore.getState().doc).toEqual(before.doc)
  },
)

test.each(['Living', 'Study'])(
  'lowering %s to the corridor removes its return without moving the other rooms',
  (name) => {
    const north = steppedHouse()
    const before = documentStore.getState(),
      wall = before.doc.walls[north(name)]!
    const room = Object.values(before.doc.rooms).find((r) => r.name === name)!.id
    previewWallMove(wall, { x: 0, y: -300 }, room)
    const preview = previewStore.getState().doc!
    expect(preview.nodes[preview.walls[wall.id]!.a]!.y).toBe(8000)
    for (const other of ['Hall', name === 'Living' ? 'Study' : 'Living']) {
      const w = before.doc.walls[north(other)]!
      expect(preview.nodes[preview.walls[w.id]!.a]!.y).toBe(before.doc.nodes[w.a]!.y)
      expect(preview.nodes[preview.walls[w.id]!.b]!.y).toBe(before.doc.nodes[w.b]!.y)
    }
    endPreview()
    moveWallBy(wall, { x: 0, y: -300 }, room)
    expect(documentStore.getState().doc).toEqual(preview)
  },
)

test('an occupied return cannot be removed by direct wall alignment', () => {
  const north = steppedHouse()
  const doc = documentStore.getState().doc
  const step = Object.values(doc.walls).find(
    (w) =>
      doc.nodes[w.a]!.x === 5000 &&
      doc.nodes[w.b]!.x === 5000 &&
      Math.abs(doc.nodes[w.a]!.y - doc.nodes[w.b]!.y) === 151,
  )!
  documentStore
    .getState()
    .exec(`add-device --kind socket --wall ${step.id} --along 75 --height 350`)
  const before = documentStore.getState(),
    wall = before.doc.walls[north('Hall')]!
  expect(() =>
    documentStore.getState().apply(updateWall, { id: wall.element ?? wall.id, by: -151 }),
  ).toThrow(/hosts/)
  moveWallBy(wall, { x: 0, y: 300 })
  expect(documentStore.getState().doc).toBe(before.doc)
  expect(documentStore.getState().past).toEqual(before.past)
})

test.each(['room', 'wall'])(
  'aligning a %s boundary contracts a segment of a longer wall and roundtrips the native graph',
  (kind) => {
    const source = splitWallFixture()
    documentStore.getState().exec(source)
    const before = documentStore.getState(),
      doc = before.doc
    const room = Object.values(doc.rooms).find((r) => r.name === 'Living')!
    const wall = Object.values(doc.walls).find(
      (w) => doc.nodes[w.a]!.y === 8151 && doc.nodes[w.b]!.y === 8151 && doc.nodes[w.b]!.x === 0,
    )!
    const graph = structuredClone(before.authoring.graph)
    const picked = kind === 'room' ? room.id : undefined
    for (const by of [-151, -250, -300]) {
      previewWallMove(wall, { x: 0, y: by }, picked)
      const preview = previewStore.getState().doc!
      expect(preview.nodes[preview.walls[wall.id]!.a]!.y).toBe(8000)
      expect(preview.nodes[preview.walls[wall.id]!.b]!.y).toBe(8000)
      expect(Object.keys(preview.walls)).toHaveLength(Object.keys(doc.walls).length - 1)
      expect(documentStore.getState().doc).toBe(doc)
      expect(documentStore.getState().past).toBe(before.past)
    }
    const preview = previewStore.getState().doc!
    endPreview()
    moveWallBy(wall, { x: 0, y: -300 }, picked)
    expect(documentStore.getState().doc).toEqual(preview)
    expect(documentStore.getState().past.length).toBe(before.past.length + 1)
    documentStore.getState().undo()
    expect(documentStore.getState().doc).toEqual(doc)
    expect(documentStore.getState().authoring.graph).toEqual(graph)
    documentStore.getState().redo()
    expect(documentStore.getState().doc).toEqual(preview)
  },
)

test('a long pointer jump cannot move a partition through another room or record the refused edit', () => {
  const source = splitWallFixture()
  documentStore.getState().exec(source)
  const before = documentStore.getState(),
    doc = before.doc,
    graph = structuredClone(before.authoring.graph)
  const wall = Object.values(doc.walls).find(
    (w) => doc.nodes[w.a]!.x === 5000 && doc.nodes[w.b]!.x === 5000,
  )!
  expect(() =>
    documentStore.getState().apply(updateWall, { id: wall.element!, by: -9000 }),
  ).toThrow()
  expect(documentStore.getState().doc).toBe(doc)
  expect(documentStore.getState().past).toBe(before.past)
  expect(documentStore.getState().authoring.graph).toEqual(graph)
  previewWallMove(wall, { x: 9000, y: 0 })
  const preview = previewStore.getState().doc!
  expect(preview.nodes[preview.walls[wall.id]!.a]!.x).toBeGreaterThan(5000)
  expect(preview.nodes[preview.walls[wall.id]!.a]!.x).toBeLessThan(6500)
  expect(Object.keys(preview.rooms)).toEqual(Object.keys(doc.rooms))
  endPreview()
  moveWallBy(wall, { x: 9000, y: 0 })
  expect(documentStore.getState().doc).toEqual(preview)
  expect(documentStore.getState().past.length).toBe(before.past.length + 1)
  documentStore.getState().undo()
  expect(documentStore.getState().doc).toEqual(doc)
  expect(documentStore.getState().authoring.graph).toEqual(graph)
})

function splitWallFixture() {
  return readFileSync('../../fixtures/that-open/split-wall-alignment.txt', 'utf8')
}
