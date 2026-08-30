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

test('a floor material sticks to the room it was given to', () => {
  const { doc, level } = floor()

  const next = runScript(doc, 'set-floor --room dům --material oak')

  expect(roomsOf(next, level)[0]?.floor).toBe('oak')
})

test('the floor survives the room being cut in two, and only the named half keeps it', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    [
      'set-floor --room dům --material oak',
      'add-room --name kuchyň --from dům --side west --width 3.6m',
    ].join('\n'),
  )
  const named = (name: string) => roomsOf(next, level).find((room) => room.name === name)

  expect(named('dům')?.floor).toBe('oak')
  expect(named('kuchyň')?.floor).toBeUndefined()
})

test('a material can be changed', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    ['set-floor --room dům --material oak', 'set-floor --room dům --material tile'].join('\n'),
  )

  expect(roomsOf(next, level)[0]?.floor).toBe('tile')
})

test('a material nobody stocks is refused, and says what there is', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'set-floor --room dům --material linoleum')).toThrow(/oak/)
})

test('flooring a room that does not exist says so', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'set-floor --room garáž --material oak')).toThrow(/garáž/)
})
