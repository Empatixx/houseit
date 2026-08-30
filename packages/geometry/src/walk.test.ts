import { expect, test } from 'vitest'
import { type Leg, walkPoints } from './outlines'

const walk = (text: string): Leg[] =>
  text.split(' ').map((leg) => ({
    heading: leg.slice(-1) as Leg['heading'],
    length: Number(leg.slice(0, -1)),
  }))

test('a walk that stops one leg short closes itself', () => {
  expect(walkPoints(walk('6000e 4000n 6000w'))).toEqual([
    { x: 0, y: 0 },
    { x: 6000, y: 0 },
    { x: 6000, y: 4000 },
    { x: 0, y: 4000 },
  ])
})

test('a walk taken all the way round does not repeat where it started', () => {
  expect(walkPoints(walk('6000e 4000n 6000w 4000s'))).toHaveLength(4)
})

test('a walk can trace any shape, not only the ones with names', () => {
  const points = walkPoints(walk('12000e 8000n 4000w 3000s 8000w'))

  expect(points).toHaveLength(6)
  expect(points).toContainEqual({ x: 8000, y: 5000 })
})

test('a walk taken clockwise is turned round, because faces are read the other way', () => {
  const clockwise = walkPoints(walk('6000n 4000e 6000s'))

  expect(clockwise[0]).not.toEqual({ x: 0, y: 6000 })
  expect(clockwise).toHaveLength(4)
})

test('a walk that cannot get home in a straight line is refused', () => {
  expect(() => walkPoints(walk('6000e 4000n 2000w 1000n'))).toThrow(/close/)
})

test('a walk that encloses nothing is refused', () => {
  expect(() => walkPoints(walk('6000e 6000w 3000e'))).toThrow(/nothing/)
})

test('a walk needs somewhere to go', () => {
  expect(() => walkPoints(walk('6000e 4000n'))).toThrow(/three sides/)
})
