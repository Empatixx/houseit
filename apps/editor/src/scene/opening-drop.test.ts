import { runScript } from '@houseit/commands/run'
import { createEmptyDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { openingDropOf } from './opening-drop'

const house = () => {
  const doc = runScript(
    createEmptyDocument(),
    'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
  )
  const level = Object.keys(doc.levels)[0]!
  return { doc, level, room: roomsOf(doc, level)[0]! }
}

test('let go near a wall, an opening goes to that wall, that far along', () => {
  const { doc, level, room } = house()

  expect(openingDropOf(doc, level, room, { x: 3000, y: 200 })).toEqual({
    toSide: 'south',
    along: 0.244,
  })
  expect(openingDropOf(doc, level, room, { x: 11_800, y: 4500 })?.toSide).toBe('east')
})

test('let go in the middle of the room, it goes to the nearest wall rather than nowhere', () => {
  const { doc, level, room } = house()

  expect(openingDropOf(doc, level, room, { x: 6000, y: 4000 })?.toSide).toBe('south')
})
