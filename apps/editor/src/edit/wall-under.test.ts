import { runScript } from '@houseit/commands/run'
import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { wallUnder } from './wall-under'

const PLAN = [
  'add-room --material natural-oak --shape rectangle --width 10m --depth 8m --name flat',
  'add-room --material beech --from flat --side north --depth 3m --name bedroom',
].join('\n')

const doc: HouseDocument = runScript(createEmptyDocument(), PLAN)
const level = Object.keys(doc.levels)[0]!
const room = roomsOf(doc, level).find((it) => it.name === 'bedroom')!
const xs = room.nodes.map((id) => doc.nodes[id]!.x)
const ys = room.nodes.map((id) => doc.nodes[id]!.y)
const middle = {
  x: (Math.min(...xs) + Math.max(...xs)) / 2,
  y: (Math.min(...ys) + Math.max(...ys)) / 2,
}

test('a click in the open floor of a room names no wall', () => {
  expect(wallUnder(doc, level, room, middle)).toBeUndefined()
})

test('a click near a wall names that wall, from either side of it', () => {
  for (const edge of [Math.min(...ys), Math.max(...ys)]) {
    for (const away of [0, 40, 80, 140]) {
      const inward = edge === Math.min(...ys) ? away : -away
      const found = wallUnder(doc, level, room, { x: middle.x, y: edge + inward })
      expect(found, `${away} mm from the wall at y=${edge}`).toBeDefined()
    }
  }
})

test('a click well clear of every wall still names none', () => {
  const edge = Math.min(...ys)
  expect(wallUnder(doc, level, room, { x: middle.x, y: edge + 400 })).toBeUndefined()
})
