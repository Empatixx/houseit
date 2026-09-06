import { expect, test } from 'vitest'
import { unionOfBoxes } from './union'

const corners = (ring: { x: number; y: number }[]) =>
  ring.map((point) => `${point.x},${point.y}`).sort()

test('one box is its own four corners', () => {
  const rings = unionOfBoxes([{ x0: 0, y0: 0, x1: 900, y1: 280 }])

  expect(rings).toHaveLength(1)
  expect(corners(rings[0]!)).toEqual(['0,0', '0,280', '900,0', '900,280'])
})

test('boxes sharing an edge are one box between them', () => {
  const rings = unionOfBoxes([
    { x0: 0, y0: 0, x1: 900, y1: 280 },
    { x0: 0, y0: 280, x1: 900, y1: 560 },
  ])

  expect(rings).toHaveLength(1)
  expect(corners(rings[0]!)).toEqual(['0,0', '0,560', '900,0', '900,560'])
})

test('an arm up and an arm across make an L with six corners', () => {
  const rings = unionOfBoxes([
    { x0: 0, y0: 0, x1: 900, y1: 2000 },
    { x0: 0, y0: 0, x1: 2000, y1: 900 },
  ])

  expect(rings).toHaveLength(1)
  expect(corners(rings[0]!)).toEqual(['0,0', '0,2000', '2000,0', '2000,900', '900,2000', '900,900'])
})

test('boxes apart stay apart', () => {
  const rings = unionOfBoxes([
    { x0: 0, y0: 0, x1: 100, y1: 100 },
    { x0: 500, y0: 500, x1: 600, y1: 600 },
  ])

  expect(rings).toHaveLength(2)
})

test('the ring is walked in order, each corner next to the ones it shares a side with', () => {
  const [ring] = unionOfBoxes([
    { x0: 0, y0: 0, x1: 900, y1: 2000 },
    { x0: 0, y0: 0, x1: 2000, y1: 900 },
  ])

  for (let index = 0; index < ring!.length; index += 1) {
    const here = ring![index]!
    const next = ring![(index + 1) % ring!.length]!
    expect(here.x === next.x || here.y === next.y, `${index}`).toBe(true)
  }
})
