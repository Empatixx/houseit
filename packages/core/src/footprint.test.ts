import { expect, test } from 'vitest'
import { declaresParts, FILLS_ITS_BOX, partsOf } from './footprint'
import { IMPORTED_TYPES } from './imported'
import { OBJECT_TYPE_IDS } from './object-types'

const SHAPE_IN_THE_NAME = /-(l|u)(-|$)/

test('anything named like an L or a U has been decided about, one way or the other', () => {
  const undecided = OBJECT_TYPE_IDS.filter(
    (id) => SHAPE_IN_THE_NAME.test(id) && !declaresParts(id) && !(id in FILLS_ITS_BOX),
  )

  expect(undecided).toEqual([])
})

test('a type nobody shaped fills the box it was cut from', () => {
  expect(partsOf('queen-bed')).toEqual([{ x0: 0, y0: 0, x1: 1, y1: 1 }])
})

test('a shaped type leaves the floor its box lies about', () => {
  const parts = partsOf('kitchen-l')

  expect(parts.length).toBeGreaterThan(1)
  expect(parts.some((part) => part.x1 < 1 || part.y1 < 1)).toBe(true)
})

test('every exception says why it is one', () => {
  for (const [id, why] of Object.entries(FILLS_ITS_BOX)) {
    expect(SHAPE_IN_THE_NAME.test(id)).toBe(true)
    expect(why.length).toBeGreaterThan(20)
  }
})

test('a type brought in as a model may say what it really fills', () => {
  for (const type of IMPORTED_TYPES.filter((entry) => entry.parts !== undefined)) {
    expect(partsOf(type.id)).toEqual(type.parts)
    expect(partsOf(type.id).length).toBeGreaterThan(1)
  }
})

test('a brought type that says nothing fills its box, like everything else', () => {
  for (const type of IMPORTED_TYPES.filter((entry) => entry.parts === undefined)) {
    expect(partsOf(type.id)).toEqual([{ x0: 0, y0: 0, x1: 1, y1: 1 }])
  }
})
