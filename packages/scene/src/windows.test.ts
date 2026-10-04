import type { Opening, Wall } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { windowPieces } from './windows'

const wall: Wall = {
  id: 'w1',
  level: 'l1',
  a: 'n1',
  b: 'n2',
  thickness: 300,
  baseOffset: 0,
  height: 2800,
}

const window: Opening = {
  id: 'o1',
  wall: 'w1',
  t: 0.5,
  kind: 'window',
  variant: 'hinged',
  width: 1200,
  height: 1500,
  sillHeight: 900,
  hinge: 'a',
  swing: 1,
}

const named = (pieces: ReturnType<typeof windowPieces>, part: string) =>
  pieces.filter((piece) => piece.key.includes(part))

test('a window is a frame, a sash, glass and a handle, all inside its opening', () => {
  const pieces = windowPieces(window, wall, 3000, 1)
  expect(named(pieces, '-frame-')).toHaveLength(4)
  expect(named(pieces, '-glass')).toHaveLength(1)
  expect(named(pieces, '-handle')).not.toHaveLength(0)
  for (const piece of pieces.filter((p) => !/board|flashing/.test(p.key))) {
    expect(piece.at - piece.length / 2).toBeGreaterThanOrEqual(3000 - window.width / 2)
    expect(piece.at + piece.length / 2).toBeLessThanOrEqual(3000 + window.width / 2)
    expect(piece.base).toBeGreaterThanOrEqual(window.sillHeight)
    expect(piece.base + piece.height).toBeLessThanOrEqual(window.sillHeight + window.height)
  }
})

test('a wide window opens as two sashes either side of a mullion', () => {
  const pieces = windowPieces({ ...window, width: 2400 }, wall, 3000, 1)
  expect(named(pieces, '-glass')).toHaveLength(2)
  expect(named(pieces, '-mullion')).toHaveLength(1)
})

test('the frame sits towards the weather and the handle faces the room', () => {
  const pieces = windowPieces(window, wall, 3000, 1)
  const frame = named(pieces, '-frame-a')[0]!
  const handle = named(pieces, 'sash-1-handle')[0]!
  expect(frame.aside).toBeGreaterThan(0)
  expect(frame.aside + frame.thickness / 2).toBeLessThan(wall.thickness / 2)
  expect(handle.aside).toBeLessThan(frame.aside)
})

test('a sill board inside and flashing outside, only where there is a sill and a weather side', () => {
  const outer = windowPieces(window, wall, 3000, 1)
  const board = named(outer, '-board')[0]!
  const flashing = named(outer, '-flashing')[0]!
  expect(board.aside).toBeLessThan(0)
  expect(board.aside - board.thickness / 2).toBeLessThan(-wall.thickness / 2)
  expect(board.base + board.height).toBeGreaterThan(window.sillHeight)
  expect(flashing.aside).toBeGreaterThan(0)
  expect(named(windowPieces(window, wall, 3000), '-flashing')).toHaveLength(0)
  expect(named(windowPieces({ ...window, sillHeight: 0 }, wall, 3000, 1), '-board')).toHaveLength(0)
})

test('a window with a measured frame and a door are drawn elsewhere', () => {
  const frame = { depth: 74, face: 50, outside: '#383e42', inside: '#f1f0ea' }
  expect(windowPieces({ ...window, frame }, wall, 3000, 1)).toEqual([])
  expect(windowPieces({ ...window, kind: 'door' }, wall, 3000, 1)).toEqual([])
})
