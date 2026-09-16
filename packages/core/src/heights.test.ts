import { expect, test } from 'vitest'
import { heightOf } from './heights'
import { importedType } from './imported'
import { OBJECT_TYPES } from './object-types'

test('a sofa is knee-and-a-half high and stands on the floor', () => {
  expect(heightOf('sofa-3')).toMatchObject({ height: 850, base: 0 })
})

test('a picture hangs on the wall, some way up', () => {
  expect(heightOf('picture-frame').base).toBe(1200)
})

test('a shower is glass, so the room shows through it', () => {
  expect(heightOf('shower-m').glass).toBe(true)
})

test('what is not listed is taken to be about table height', () => {
  expect(heightOf('nothing-of-the-kind')).toEqual({ height: 750, base: 0, glass: undefined })
})

test('every type in the catalogue has a height of its own', () => {
  const guessed = OBJECT_TYPES.filter(
    (type) => heightOf(type.id).height === 750 && importedType(type.id)?.size.height !== 750,
  ).map((t) => t.id)
  expect(guessed).toEqual([])
})

test('the standalone television rests on the matching cabinet', () => {
  expect(heightOf('television-flat').base).toBe(heightOf('tv-stand-wood').height)
})
