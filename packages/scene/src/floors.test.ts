import { FLOOR_MATERIAL_IDS, floorMaterial } from '@houseit/core/floor-materials'
import { SLAB } from '@houseit/core/levels'
import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { ceilingPieces, floorPieces, underfloorPieces } from './floors'

const room = () =>
  planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])

test('a room gets a floor the shape of the room', () => {
  const { doc, level } = room()

  const laid = floorPieces(doc, level)
  expect(laid).toHaveLength(1)
  if (laid[0]?.body.kind !== 'sheet') throw new Error('a floor is a sheet')
  expect(laid[0].body.outline).toHaveLength(4)
  expect(laid[0].body.holes).toEqual([])
})

test('a lower outdoor surface replaces only the floor buildup above the basement slab', () => {
  const { doc, level } = room()
  Object.assign(doc.levels[level]!, {
    elevation: -3000,
    height: 3000,
    clearHeight: 2550,
    slabThickness: 250,
  })
  const before = ceilingPieces(doc, level)
  doc.site = {
    groundCutout: { x0: -1000, x1: 5000, y0: -1000, y1: 5000 },
    surfaces: [
      {
        id: 'walk',
        name: 'Walk',
        outline: [
          { x: 2000, y: -1000 },
          { x: 5000, y: -1000 },
          { x: 5000, y: 5000 },
          { x: 2000, y: 5000 },
        ],
        elevation: -20,
        slope: { x: 0, y: 0 },
        depth: 180,
        kind: 'paving',
        colour: '#aaaaaa',
      },
    ],
    markings: [],
    railings: [],
  }
  const after = ceilingPieces(doc, level)
  expect(after.find((p) => !p.name?.includes('buildup'))).toEqual(
    before.find((p) => !p.name?.includes('buildup')),
  )
  for (const p of after.filter((p) => p.name?.includes('buildup'))) {
    if (p.body.kind !== 'prism') throw Error('prism expected')
    expect(Math.max(...p.body.outline.map((p) => p.x))).toBeLessThanOrEqual(2000)
  }
  doc.levels[level]!.elevation = 0
  const upstairs = ceilingPieces(doc, level)
  expect(upstairs).toEqual(before)
})

test('a room with nothing laid in it still has a floor to stand on', () => {
  const { doc, level } = room()

  expect(floorPieces(doc, level)[0]?.paint.texture).toBeUndefined()
  expect(floorPieces(doc, level)[0]?.paint.colour).toMatch(/^#/)
})

test('a floor laid in a material wears its picture, tiled at the size the material really is', () => {
  const { doc, level } = room()
  const id = FLOOR_MATERIAL_IDS[0]!
  const material = floorMaterial(id)!
  doc.rooms.r1 = { id: 'r1', level, x: 2000, y: 1500, name: 'room', floor: id, loop: [] }

  const laid = floorPieces(doc, level)[0]!
  expect(laid.paint.texture).toBe(material.texture)
  expect(laid.paint.repeat).toEqual({
    x: 1000 / material.unit.width,
    y: 1000 / material.unit.depth,
  })
})

test('a storey has a lid, and it sits under the top of its walls', () => {
  const { doc, level } = room()
  const top = doc.levels[level]!.height

  const lid = ceilingPieces(doc, level)[0]!
  if (lid.body.kind !== 'prism') throw new Error('a ceiling is a prism')
  expect(lid.body.thickness).toBe(SLAB)
  expect(lid.at.y).toBeCloseTo(top - SLAB / 2)
})

test('no flat slab stops the sun, because a plan walked through is lit from above', () => {
  const { doc, level } = room()

  expect(ceilingPieces(doc, level)[0]?.casts).toBe(false)
  expect(floorPieces(doc, level)[0]?.casts).toBe(false)
})

test('the slab reaches the outside structural face instead of leaving half the perimeter wall uncovered', () => {
  const { doc, level } = room()
  const lid = ceilingPieces(doc, level)[0]!
  if (lid.body.kind !== 'prism') throw Error('prism expected')
  const half = doc.walls.w1!.thickness / 2
  expect(Math.min(...lid.body.outline.map((p) => p.x))).toBeCloseTo(-half)
  expect(Math.max(...lid.body.outline.map((p) => p.x))).toBeCloseTo(4000 + half)
})

test('the lowest floor has a solid underside and a finish visible only from above', () => {
  const { doc, level } = room()
  const floor = floorPieces(doc, level)[0]!
  expect(floor.body.kind === 'sheet' && floor.body.doubleSided).toBe(false)
  const base = underfloorPieces(doc, level)[0]!
  if (base.body.kind !== 'prism') throw Error('solid underside expected')
  expect(base.at.y + base.body.thickness / 2).toBe(0)
  expect(base.at.y - base.body.thickness / 2).toBe(-SLAB)
  expect(base.body.top).toEqual([])
})

test('an upper overhang gets only the missing slab, including the floor buildup depth', () => {
  const { doc, level } = room()
  doc.levels[level]!.height = 3000
  doc.levels[level]!.clearHeight = 2600
  doc.levels.up = { id: 'up', name: 'Upper', elevation: 3000, height: 3000 }
  for (const [id, node] of Object.entries({ ...doc.nodes }))
    doc.nodes[`up-${id}`] = { ...node, id: `up-${id}`, x: node.x + 2000 }
  for (const [id, wall] of Object.entries({ ...doc.walls }))
    doc.walls[`up-${id}`] = {
      ...wall,
      id: `up-${id}`,
      a: `up-${wall.a}`,
      b: `up-${wall.b}`,
      level: 'up',
    }
  const base = underfloorPieces(doc, 'up')
  expect(base.length).toBeGreaterThan(0)
  let area = 0
  for (const piece of base) {
    if (piece.body.kind !== 'prism') throw Error('solid underside expected')
    expect(piece.body.thickness).toBe(400)
    expect(piece.body.outline.every((p) => p.x >= 4075)).toBe(true)
    const r = piece.body.outline
    area +=
      Math.abs(
        r.reduce((sum, p, i) => {
          const q = r[(i + 1) % r.length]!
          return sum + p.x * q.z - q.x * p.z
        }, 0),
      ) / 2
  }
  expect(area).toBeCloseTo(2000 * 3150)
  for (const node of Object.values(doc.nodes).filter((n) => n.id.startsWith('up-'))) node.x -= 2000
  expect(underfloorPieces(doc, 'up')).toEqual([])
})
