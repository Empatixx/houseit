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

test('what lies outside the walls says so, and a winter garden is glass', () => {
  expect(kindOf('Zimní zahrada')?.glazed).toBe(true)
  expect(kindOf('Terasa')?.outdoor).toBe(true)
  expect(kindOf('Dlažba u vjezdu')?.id).toBe('paving')
  expect(kindOf('Chodník')?.id).toBe('path')
  expect(kindOf('Chodba')?.outdoor).toBe(false)
})

test('the greenery left over in a courtyard is a lawn, outside the house', () => {
  expect(kindOf('Zeleň')?.id).toBe('lawn')
  expect(kindOf('Zeleň')?.outdoor).toBe(true)
  expect(kindOf('Zimní zahrada')?.id).toBe('winter-garden')
})
