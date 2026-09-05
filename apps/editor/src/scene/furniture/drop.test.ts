import { runScript } from '@houseit/commands/run'
import { createEmptyDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { dropOf } from './drop'

const house = () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
      'add-object --room house --type nightstand --against north',
    ].join('\n'),
  )
  const level = Object.keys(doc.levels)[0]!
  const room = roomsOf(doc, level)[0]!
  const object = Object.values(doc.objects)[0]!
  return { doc, level, room, object }
}

test('let go with its back near a wall, a thing goes against that wall, that far along', () => {
  const { doc, level, room, object } = house()

  // Near the south wall, a quarter of the way along it.
  const drop = dropOf(doc, level, room, object, { x: 3000, y: 150 + object.depth / 2 + 100 })

  expect(drop.against).toBe('south')
  expect(drop.along).toBeCloseTo(0.25, 1)
  expect(drop.across).toBeUndefined()
})

test('let go in the middle of the room, a thing stands free there', () => {
  const { doc, level, room, object } = house()

  const drop = dropOf(doc, level, room, object, { x: 6000, y: 4500 })

  expect(drop.against).toBeUndefined()
  expect(drop).toEqual({ along: 0.5, across: 0.5 })
})

test('the nearest wall wins in a corner', () => {
  const { doc, level, room, object } = house()

  const drop = dropOf(doc, level, room, object, {
    x: 12_000 - 150 - object.depth / 2 - 50,
    y: 4500,
  })

  expect(drop.against).toBe('east')
})
