import { expect, test } from 'vitest'
import { freeSpans, widestSpan } from './spans'

test('a wall with nothing in it is free along its whole length', () => {
  expect(freeSpans(4000, [])).toEqual([{ from: 0, to: 4000 }])
})

test('an opening leaves a free stretch either side of it', () => {
  expect(freeSpans(4000, [{ from: 1400, to: 2600 }])).toEqual([
    { from: 0, to: 1400 },
    { from: 2600, to: 4000 },
  ])
})

test('openings that touch the ends leave nothing there', () => {
  expect(freeSpans(4000, [{ from: 0, to: 1000 }])).toEqual([{ from: 1000, to: 4000 }])
  expect(freeSpans(4000, [{ from: 3000, to: 4000 }])).toEqual([{ from: 0, to: 3000 }])
})

test('overlapping openings are treated as one', () => {
  expect(
    freeSpans(4000, [
      { from: 1000, to: 2000 },
      { from: 1500, to: 2500 },
    ]),
  ).toEqual([
    { from: 0, to: 1000 },
    { from: 2500, to: 4000 },
  ])
})

test('an opening reaching past the end does not leave a negative stretch', () => {
  expect(freeSpans(4000, [{ from: -200, to: 4200 }])).toEqual([])
})

test('the widest stretch wins, and the first of equals', () => {
  expect(
    widestSpan([
      { from: 0, to: 1000 },
      { from: 2000, to: 3500 },
    ]),
  ).toEqual({
    from: 2000,
    to: 3500,
  })
  expect(
    widestSpan([
      { from: 0, to: 1000 },
      { from: 2000, to: 3000 },
    ]),
  ).toEqual({
    from: 0,
    to: 1000,
  })
  expect(widestSpan([])).toBeUndefined()
})
