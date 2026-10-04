import { soffitOf } from '@houseit/core/levels'
import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { ceilingLightsOn, fixturePieces, fixturesOn } from './fixtures'

const room = (width: number, depth: number, name: string, kind?: string) => {
  const { doc, level } = planWith([
    [0, 0, width, 0],
    [width, 0, width, depth],
    [width, depth, 0, depth],
    [0, depth, 0, 0],
  ])
  doc.rooms.r1 = {
    id: 'r1',
    level,
    x: width / 2,
    y: depth / 2,
    name,
    loop: [],
    ...(kind ? { kind } : {}),
  }
  return { doc, level }
}

test('a living room hangs a pendant, a bathroom keeps its light against the ceiling', () => {
  const living = room(4000, 4000, 'Obývák', 'living')
  const bath = room(2000, 2400, 'Koupelna', 'bathroom')
  expect(fixturesOn(living.doc, living.level).map((f) => f.style)).toEqual(['pendant'])
  expect(fixturesOn(bath.doc, bath.level).map((f) => f.style)).toEqual(['flush'])
})

test('a big room is lit from more than one point, all of them inside it', () => {
  const { doc, level } = room(9000, 6000, 'Hala')
  const lit = fixturesOn(doc, level)
  expect(lit.length).toBeGreaterThan(1)
  for (const fixture of lit) {
    expect(fixture.at.x).toBeGreaterThan(0)
    expect(fixture.at.x).toBeLessThan(9000)
    expect(fixture.at.y).toBeGreaterThan(0)
    expect(fixture.at.y).toBeLessThan(6000)
  }
  const total = lit.reduce((sum, f) => sum + f.lumens, 0)
  expect(total).toBeGreaterThan(54 * 100)
})

test('an outdoor space has no ceiling light', () => {
  const { doc, level } = room(4000, 3000, 'Terasa', 'terrace')
  expect(fixturesOn(doc, level)).toEqual([])
})

test('a fixture hangs from the ceiling and stays above head height', () => {
  const { doc, level } = room(4000, 4000, 'Obývák', 'living')
  const ceiling = soffitOf(doc.levels[level]!)
  const pieces = fixturePieces(doc, level)
  expect(pieces.every((p) => p.role === 'light-fixture' && p.of?.id === 'r1')).toBe(true)
  for (const piece of pieces) {
    if (piece.body.kind !== 'drum' && piece.body.kind !== 'box') continue
    const height = piece.body.height
    expect(piece.at.y + height / 2, piece.name).toBeLessThan(ceiling)
    expect(piece.at.y - height / 2, piece.name).toBeGreaterThanOrEqual(2100)
  }
  expect(pieces.some((p) => p.paint.glow)).toBe(true)
  const [light] = ceilingLightsOn(doc, level)
  expect(light!.at.y).toBeLessThan(ceiling)
  expect(light!.at.y).toBeGreaterThan(2100)
  expect(light!.power).toBeGreaterThan(0)
})
