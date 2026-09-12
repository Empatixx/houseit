import type { Opening } from '@houseit/core/document'
import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { wallPieces } from './walls'

const room = () =>
  planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])

const opening = (over: Partial<Opening> & Pick<Opening, 'id' | 'wall' | 'kind'>): Opening => ({
  t: 0.5,
  variant: 'hinged',
  width: 900,
  height: 2000,
  sillHeight: 0,
  hinge: 'a',
  swing: 1,
  ...over,
})

test('a blank wall is two halves, one for each room it divides, so they can differ', () => {
  const { doc, level } = room()

  const built = wallPieces(doc, level).filter((piece) => piece.of?.id === 'w1')
  const depths = built.map((piece) => (piece.body.kind === 'box' ? piece.body.depth : 0))
  const thickness = doc.walls.w1!.thickness

  expect(built).toHaveLength(2)
  expect(depths).toEqual([thickness / 2, thickness / 2])
})

test('a wall with a door in it is the pieces the hole leaves, plus what stands in the hole', () => {
  const { doc, level } = room()
  doc.openings.o1 = opening({ id: 'o1', wall: 'w1', kind: 'door' })

  const built = wallPieces(doc, level)
  expect(built.filter((piece) => piece.of?.id === 'w1').length).toBeGreaterThan(1)
  expect(built.some((piece) => piece.of?.kind === 'opening' && piece.of.id === 'o1')).toBe(true)
})

test('a window is glazed, and the pane is the only see-through thing in the wall', () => {
  const { doc, level } = room()
  doc.openings.o1 = opening({ id: 'o1', wall: 'w1', kind: 'window', sillHeight: 900, height: 1200 })

  const panes = wallPieces(doc, level).filter((piece) => (piece.paint.opacity ?? 1) < 1)
  expect(panes).toHaveLength(1)
  expect(panes[0]?.of).toEqual({ kind: 'opening', id: 'o1' })
})

test('a piece of a wall stands where the wall does and lies along it', () => {
  const { doc, level } = room()

  const halves = wallPieces(doc, level).filter((piece) => piece.of?.id === 'w1')
  const thickness = doc.walls.w1!.thickness

  for (const half of halves) {
    expect(half.at.x).toBeCloseTo(2000)
    expect(half.turn).toBeCloseTo(0)
  }
  expect(halves.map((half) => half.at.z).sort((one, other) => one - other)).toEqual([
    -thickness / 4,
    thickness / 4,
  ])
})

test('a wall standing on another storey is not this storey business', () => {
  const { doc, level } = room()
  doc.walls.w1!.level = 'somewhere-else'

  expect(wallPieces(doc, level).some((piece) => piece.of?.id === 'w1')).toBe(false)
})

test('a measured soffit caps full-height walls while low returns retain their own height', () => {
  const { doc, level } = room()
  doc.levels[level]!.height = 3760
  doc.levels[level]!.clearHeight = 3380
  for (const wall of Object.values(doc.walls)) wall.height = 3760
  doc.walls.w2!.height = 1000
  const built = wallPieces(doc, level).filter((p) => p.of?.kind === 'wall')
  for (const piece of built) {
    if (piece.body.kind !== 'box') throw Error('box expected')
    expect(piece.at.y + piece.body.height / 2).toBeCloseTo(piece.of!.id === 'w2' ? 1000 : 3380)
  }
})
