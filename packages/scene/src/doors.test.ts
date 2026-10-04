import type { Opening, Wall } from '@houseit/core/document'
import { openingParts } from '@houseit/core/opening-parts'
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

const panels = (pieces: ReturnType<typeof doorPieces>) =>
  pieces.filter((piece) => /-(leaf|near|far|panel)$/.test(piece.key))

test('a sliding door is two panels in the wall, a pocket door one', () => {
  const sliding = panels(doorPieces({ ...door, variant: 'sliding', width: 1600 }, wall, 3000))
  const pocket = panels(doorPieces({ ...door, variant: 'pocket' }, wall, 3000))

  expect(sliding).toHaveLength(2)
  expect(sliding.every((piece) => piece.turn === 0)).toBe(true)
  expect(sliding.map((piece) => piece.length)).toEqual([800, 800])
  expect(pocket).toHaveLength(1)
  expect(pocket[0]!.length).toBe(door.width)
  expect(pocket[0]!.at).toBe(3000 - door.width)
  const opposite = panels(doorPieces({ ...door, variant: 'pocket', slide: 'b' }, wall, 3000))
  expect(opposite[0]!.at).toBe(3000 + door.width)
})

test('the reveal is lined: a jamb each side and a soffit over', () => {
  const pieces = doorPieces(door, wall, 3000)
  const jambs = pieces.filter((piece) => piece.key.includes('-jamb-'))
  const soffit = pieces.find((piece) => piece.key.endsWith('-soffit'))!

  expect(jambs).toHaveLength(2)
  expect(jambs.every((jamb) => jamb.thickness === wall.thickness)).toBe(true)
  expect(jambs.every((jamb) => jamb.height === door.height)).toBe(true)
  expect(jambs.map((jamb) => jamb.at).sort((a, b) => a - b)).toEqual([
    3000 - (door.width - 40) / 2,
    3000 + (door.width - 40) / 2,
  ])
  expect(soffit.base + soffit.height).toBe(door.height)
  expect(soffit.thickness).toBe(wall.thickness)
})

test('what stands in the wall stops under the soffit', () => {
  for (const variant of ['sliding', 'pocket', 'garage'] as const) {
    for (const panel of panels(doorPieces({ ...door, variant }, wall, 3000))) {
      expect(panel.base + panel.height, variant).toBeLessThan(door.height)
    }
  }
})

test('a window grows no door', () => {
  expect(doorPieces({ ...door, kind: 'window' }, wall, 3000)).toEqual([])
})

test('a glazed door leaf carries its own frame with separate inside and outside faces', () => {
  const glazed = {
    ...door,
    width: 1100,
    height: 2100,
    frame: { depth: 74, face: 50, outside: '#383e42', inside: '#f1f0ea' },
  }
  const pieces = doorPieces(glazed, wall, 3000, -1)
  const glass = pieces.find((p) => p.key === 'd1-leaf')!
  const frame = pieces.filter((p) => p.key.includes('leaf-frame'))
  expect(frame).toHaveLength(8)
  expect(frame.filter((p) => p.colour === glazed.frame.inside)).toHaveLength(4)
  expect(frame.filter((p) => p.colour === glazed.frame.outside)).toHaveLength(4)
  expect(
    Math.max(...frame.map((p) => p.at + p.thickness / 2)) -
      Math.min(...frame.map((p) => p.at - p.thickness / 2)),
  ).toBe(74)
  expect(glass.length).toBeLessThan(1000)
  expect(glass.height).toBeLessThan(2100)
  expect(glass.thickness).toBeLessThan(10)
  expect(pieces.some((p) => p.key.includes('jamb'))).toBe(false)
})

test('a framed solid leaf has two opaque faces instead of a transparent infill', () => {
  const solid = {
    ...door,
    infill: 'opaque' as const,
    width: 1250,
    height: 2100,
    frame: { depth: 74, face: 60, outside: '#383e42', inside: '#f1f0ea' },
  }
  const pieces = doorPieces(solid, wall, 3000, -1)
  const faces = pieces.filter((p) => p.key === 'd1-leaf-1' || p.key === 'd1-leaf--1')
  expect(faces).toHaveLength(2)
  expect(new Set(faces.map((p) => p.colour))).toEqual(new Set(['#383e42', '#f1f0ea']))
  expect(faces.reduce((sum, p) => sum + p.thickness, 0)).toBe(40)
  expect(pieces.some((p) => p.takesFinish)).toBe(false)
})

test('paired wooden leaves have outer jambs and no fixed meeting post', () => {
  const paired = { ...door, width: 1600, leafWidth: 900 }
  const parts = openingParts(paired, 6000)
  const pieces = parts.flatMap((part) => doorPieces(part, wall, part.t * 6000))
  expect(pieces.filter((p) => p.key.includes('-jamb-'))).toHaveLength(2)
  expect(
    pieces
      .filter((p) => p.key.endsWith('-leaf'))
      .map((p) => p.length)
      .sort(),
  ).toEqual([700, 900])
  const jambs = pieces
    .filter((p) => p.key.includes('-jamb-'))
    .map((p) => p.at)
    .sort((a, b) => a - b)
  expect(jambs[1]! - jambs[0]!).toBeCloseTo(1560, 6)
})

test('a hinged door is trimmed on both faces, hung on three hinges and handled from both sides', () => {
  const pieces = doorPieces(door, wall, 3000)
  const architraves = pieces.filter((piece) => piece.key.includes('-architrave-'))
  expect(architraves).toHaveLength(6)
  expect(new Set(architraves.map((piece) => Math.sign(piece.aside)))).toEqual(new Set([1, -1]))
  expect(architraves.every((piece) => Math.abs(piece.aside) > wall.thickness / 2)).toBe(true)
  expect(pieces.filter((piece) => piece.key.includes('-hinge-'))).toHaveLength(3)
  const leaf = pieces.find((piece) => piece.key === 'd1-leaf')!
  const front = pieces.find((piece) => piece.key === 'd1-handle')!
  const back = pieces.find((piece) => piece.key === 'd1-handle-back')!
  expect(Math.sign(front.at - leaf.at)).toBe(-Math.sign(back.at - leaf.at))
  expect(Math.abs(front.at - leaf.at)).toBeGreaterThan(leaf.thickness / 2)
})
