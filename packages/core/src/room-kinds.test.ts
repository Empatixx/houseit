import { expect, test } from 'vitest'
import { kindOf, ROOM_KINDS } from './room-kinds'

test('a name says what kind of room it is, in English or Czech', () => {
  expect(kindOf('master bedroom')?.id).toBe('bedroom')
  expect(kindOf('Ložnice 2')?.id).toBe('bedroom')
  expect(kindOf('kuchyň')?.id).toBe('kitchen')
  expect(kindOf('walk-in')?.id).toBe('walk-in')
  expect(kindOf('hall')?.id).toBe('hall')
})

test('the more particular word wins over the general one', () => {
  expect(kindOf('half bath')?.id).toBe('half-bath')
  expect(kindOf('bathroom')?.id).toBe('bathroom')
})

test('a name that says nothing is nothing, not a guess', () => {
  expect(kindOf('dům')).toBeUndefined()
  expect(kindOf(undefined)).toBeUndefined()
})

test('every kind has a word to be found by and a floor to its size', () => {
  for (const kind of ROOM_KINDS) {
    expect(kind.words.length).toBeGreaterThan(0)
    expect(kind.minArea).toBeGreaterThan(0)
  }
})
