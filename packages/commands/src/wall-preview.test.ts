import { createEmptyDocument } from '@houseit/core/document'
import { afterEach, expect, test, vi } from 'vitest'
import { applyCommand, runScript } from './run'
import * as standing from './standing-check'
import { updateRoom } from './update-room'
import { updateWall } from './wall'
import { previewWallCommand } from './wall-preview'

afterEach(() => vi.restoreAllMocks())

function house() {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --name Room --width 8000 --depth 6000 --material natural-oak',
      'add-object --room Room --type dining-round-4 --along 0.5 --across 0.5',
    ].join('\n'),
  )
  const wall = Object.values(doc.walls).find(
    (w) => doc.nodes[w.a]!.y === 6000 && doc.nodes[w.b]!.y === 6000,
  )!
  return { doc, wall, room: Object.keys(doc.rooms)[0]! }
}

test.each(['room', 'wall'])(
  'a %s preview skips furniture collisions but the committed command refuses them',
  (kind) => {
    const { doc, wall, room } = house()
    const before = structuredClone(doc)
    const check = vi.spyOn(standing, 'standingProblem')
    const command = kind === 'room' ? updateRoom : updateWall
    const args = kind === 'room' ? { room, wall: wall.id, by: -3000 } : { id: wall.id, by: 3000 }
    const preview = previewWallCommand(doc, command, args)
    expect(preview.nodes[wall.a]!.y).toBe(3000)
    expect(check).not.toHaveBeenCalled()
    expect(() => applyCommand(doc, command, args)).toThrow(/f1/)
    expect(check).toHaveBeenCalled()
    expect(doc).toEqual(before)
  },
)

test('previews still enforce wall openings and leave failed edits isolated', () => {
  const { doc, wall, room } = house()
  const glazed = runScript(doc, 'add-opening --room Room --side west --kind window --width 1800')
  const args = { room, wall: wall.id, by: -5500 }
  expect(() => previewWallCommand(glazed, updateRoom, args)).toThrow()
  expect(() => applyCommand(glazed, updateRoom, args)).toThrow()
})
