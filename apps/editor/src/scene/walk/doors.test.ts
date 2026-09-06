import type { Opening, Wall } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { doorPieces } from './doors'

const wall: Wall = {
  id: 'w1',
  level: 'l1',
  a: 'n1',
  b: 'n2',
  thickness: 300,
  baseOffset: 0,
  height: 2800,
}

const door: Opening = {
  id: 'd1',
  wall: 'w1',
  t: 0.5,
  kind: 'door',
  variant: 'hinged',
  width: 900,
  height: 1970,
  sillHeight: 0,
  hinge: 'a',
  swing: 1,
}

test('a leaf is as tall as the door, not as tall as the wall', () => {
  const leaf = doorPieces(door, wall, 3000).find((piece) => piece.key === 'd1-leaf')!

  expect(leaf.height).toBe(door.height)
  expect(leaf.base).toBe(0)
  expect(leaf.base + leaf.height).toBeLessThan(wall.height)
})

test('a leaf is a door thick, not half a wall thick', () => {
  const leaf = doorPieces(door, wall, 3000).find((piece) => piece.key === 'd1-leaf')!

  expect(leaf.thickness).toBeLessThan(60)
})

test('a hinged leaf stands open, clear of the wall it hangs in', () => {
  const leaf = doorPieces(door, wall, 3000).find((piece) => piece.key === 'd1-leaf')!
  const face = wall.thickness / 2

  expect(leaf.turn).toBeCloseTo(Math.PI / 2)
  expect(leaf.aside - leaf.length / 2).toBeCloseTo(face)
  expect(leaf.aside + leaf.length / 2).toBeCloseTo(face + door.width)
})

test('there is something to open it with, at a handle height', () => {
  const handle = doorPieces(door, wall, 3000).find((piece) => piece.key === 'd1-handle')!

  expect(handle.base).toBeGreaterThan(900)
  expect(handle.base).toBeLessThan(1200)
})

test('a sliding door is two panels in the wall, a pocket door one', () => {
  const sliding = doorPieces({ ...door, variant: 'sliding', width: 1600 }, wall, 3000)
  const pocket = doorPieces({ ...door, variant: 'pocket' }, wall, 3000)

  expect(sliding).toHaveLength(2)
  expect(sliding.every((piece) => piece.turn === 0)).toBe(true)
  expect(sliding.map((piece) => piece.length)).toEqual([800, 800])
  expect(pocket).toHaveLength(1)
  expect(pocket[0]!.length).toBe(door.width)
})

test('a window grows no door', () => {
  expect(doorPieces({ ...door, kind: 'window' }, wall, 3000)).toEqual([])
})
