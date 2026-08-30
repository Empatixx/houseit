import { createEmptyDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

const FLOOR = 'floor-shape --kind rectangle --width 12m --depth 9m --name dům'

const floor = () => {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  return { doc: runScript(doc, FLOOR), level }
}

const named = (doc: ReturnType<typeof floor>['doc'], level: string, name: string) =>
  roomsOf(doc, level).find((room) => room.name === name)

test('cutting a room off one side leaves two rooms', () => {
  const { doc, level } = floor()

  const next = runScript(doc, 'add-room --name kuchyň --from dům --side west --width 3.6m')

  expect(roomsOf(next, level)).toHaveLength(2)
})

test('the two rooms share the partition, so their areas still add up to the whole floor', () => {
  const { doc, level } = floor()

  const next = runScript(doc, 'add-room --name kuchyň --from dům --side west --width 3.6m')
  const total = roomsOf(next, level).reduce((sum, room) => sum + room.area, 0)

  expect(total).toBe(12_000 * 9000)
})

test('the new room is as wide as asked, measured from the side it was cut from', () => {
  const { doc, level } = floor()

  const next = runScript(doc, 'add-room --name kuchyň --from dům --side west --width 3.6m')

  expect(named(next, level, 'kuchyň')?.area).toBe(3600 * 9000)
})

test('the remainder keeps the name it had', () => {
  const { doc, level } = floor()

  const next = runScript(doc, 'add-room --name kuchyň --from dům --side west --width 3.6m')

  expect(named(next, level, 'dům')?.area).toBe(8400 * 9000)
})

test('every side of the compass works', () => {
  for (const side of ['north', 'south', 'east', 'west']) {
    const { doc, level } = floor()

    const next = runScript(doc, `add-room --name pokoj --from dům --side ${side} --width 3m`)
    const room = named(next, level, 'pokoj')

    expect(room?.area).toBe(side === 'north' || side === 'south' ? 12_000 * 3000 : 3000 * 9000)
  }
})

test('rooms can be cut out of rooms that were themselves cut', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    [
      'add-room --name kuchyň --from dům --side west --width 3.6m',
      'add-room --name koupelna --from dům --side north --width 2.4m',
    ].join('\n'),
  )

  expect(roomsOf(next, level)).toHaveLength(3)
  expect(named(next, level, 'koupelna')?.area).toBe(8400 * 2400)
})

test('a room wider than what it is cut from is refused', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'add-room --name x --from dům --side west --width 20m')).toThrow(
    /wide|width/i,
  )
})

test('cutting from a room that does not exist says so', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'add-room --name x --from garáž --side west --width 2m')).toThrow(
    /garáž/,
  )
})

const L_FLOOR =
  'floor-shape --kind l --width 12m --depth 9m --notch-width 4m --notch-depth 3m --name dům'

const lFloor = () => {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  return { doc: runScript(doc, L_FLOOR), level }
}

test('cutting off a stepped side is refused rather than left with a tail', () => {
  const { doc } = lFloor()

  expect(() =>
    runScript(doc, 'add-room --name ložnice --from dům --side north --width 3.4m'),
  ).toThrow(/north side of dům/)
})

test('a straight side of a non-rectangular room can still be cut', () => {
  const { doc, level } = lFloor()

  const next = runScript(doc, 'add-room --name spíž --from dům --side east --width 3m')

  expect(named(next, level, 'spíž')?.area).toBe(3000 * 6000)
})
