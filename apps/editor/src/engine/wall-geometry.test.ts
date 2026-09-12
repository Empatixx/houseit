// @vitest-environment node
import { createEmptyDocument, type HouseDocument, type Wall } from '@houseit/core/document'
import { GeometryEngine } from '@thatopen/fragments'
import { type BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { IfcAPI } from 'web-ifc'
import { wallBody } from './wall-body'
import { wallGeometry } from './wall-geometry'

const api = new IfcAPI()
let engine: GeometryEngine
beforeAll(async () => {
  await api.Init(undefined, true)
  engine = new GeometryEngine(api)
})
afterAll(() => api.Dispose())

function specimen(segments: [number, number, number, number, number][]) {
  const doc = createEmptyDocument(),
    level = Object.keys(doc.levels)[0]!
  doc.levels[level]!.clearHeight = 2800
  const node = (x: number, y: number) => {
    const id = `${x}:${y}`
    doc.nodes[id] = { id, x, y }
    return id
  }
  for (const [x, y, xx, yy, thickness] of segments) {
    const id = `w${Object.keys(doc.walls).length + 1}`
    doc.walls[id] = {
      id,
      level,
      a: node(x, y),
      b: node(xx, yy),
      thickness,
      height: 2800,
      baseOffset: 0,
    }
  }
  return doc
}

function volume(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position')
  let sum = 0
  for (let i = 0; i < p.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(p, i),
      b = new Vector3().fromBufferAttribute(p, i + 1),
      c = new Vector3().fromBufferAttribute(p, i + 2)
    sum += a.dot(b.cross(c)) / 6
  }
  return Math.abs(sum)
}

function built(doc: HouseDocument, wall: Wall, plan = false) {
  return wallGeometry(engine, wallBody(doc, wall, plan))
}

test('native wall volume subtracts exactly a door and a window and leaves the sill solid', () => {
  const doc = specimen([[0, 0, 6000, 0, 300]]),
    wall = doc.walls.w1!
  const solid = built(doc, wall)
  expect(volume(solid)).toBeCloseTo(6 * 2.8 * 0.3, 5)
  solid.dispose()
  doc.openings.o1 = {
    id: 'o1',
    wall: wall.id,
    t: 0.25,
    kind: 'window',
    variant: 'hinged',
    width: 1200,
    height: 1500,
    sillHeight: 900,
    hinge: 'a',
    swing: 1,
  }
  doc.openings.o2 = {
    id: 'o2',
    wall: wall.id,
    t: 0.75,
    kind: 'door',
    variant: 'hinged',
    width: 900,
    height: 1970,
    sillHeight: 0,
    hinge: 'a',
    swing: 1,
  }
  const cut = built(doc, wall)
  expect(volume(cut)).toBeCloseTo((6 * 2.8 - 1.2 * 1.5 - 0.9 * 1.97) * 0.3, 5)
  const mesh = new Mesh(cut, new MeshBasicMaterial({ side: DoubleSide }))
  expect(
    new Raycaster(new Vector3(1.5, 1.5, 1), new Vector3(0, 0, -1)).intersectObject(mesh),
  ).toHaveLength(0)
  expect(
    new Raycaster(new Vector3(1.5, 0.4, 1), new Vector3(0, 0, -1)).intersectObject(mesh).length,
  ).toBeGreaterThan(0)
  cut.dispose()
  mesh.material.dispose()
})

test('four mitred walls have the exact shell volume without duplicate corner blocks', () => {
  const doc = specimen([
    [0, 0, 6000, 0, 300],
    [6000, 0, 6000, 5000, 300],
    [6000, 5000, 0, 5000, 300],
    [0, 5000, 0, 0, 300],
  ])
  const geometries = Object.values(doc.walls).map((wall) => built(doc, wall))
  expect(geometries.reduce((sum, g) => sum + volume(g), 0)).toBeCloseTo(
    (6.3 * 5.3 - 5.7 * 4.7) * 2.8,
    4,
  )
  for (const geometry of geometries) geometry.dispose()
})

test('a T junction with unequal thicknesses has no duplicate occupied volume', () => {
  const doc = specimen([
    [0, 0, 3000, 0, 300],
    [3000, 0, 6000, 0, 300],
    [3000, 0, 3000, 3000, 150],
  ])
  const geometries = Object.values(doc.walls).map((wall) => built(doc, wall))
  expect(geometries.reduce((sum, g) => sum + volume(g), 0)).toBeCloseTo(
    (6 * 0.3 + (3 - 0.15) * 0.15) * 2.8,
    4,
  )
  for (const geometry of geometries) geometry.dispose()
})

test('plan symbols cut the complete height using the same wall profile', () => {
  const doc = specimen([[0, 0, 6000, 0, 300]]),
    wall = doc.walls.w1!
  doc.openings.o1 = {
    id: 'o1',
    wall: wall.id,
    t: 0.5,
    kind: 'window',
    variant: 'hinged',
    width: 1200,
    height: 1500,
    sillHeight: 900,
    hinge: 'a',
    swing: 1,
  }
  const geometry = built(doc, wall, true)
  expect(volume(geometry)).toBeCloseTo((6 - 1.2) * 2.8 * 0.3, 5)
  geometry.dispose()
})

test('a low return does not remove material from its tall neighbour above the return', () => {
  const doc = specimen([
    [0, 0, 3000, 0, 300],
    [3000, 0, 6000, 0, 300],
    [3000, 0, 3000, 3000, 150],
  ])
  doc.walls.w3!.height = 1000
  const geometries = Object.values(doc.walls).map((wall) => built(doc, wall))
  expect(geometries.reduce((sum, g) => sum + volume(g), 0)).toBeCloseTo(
    6 * 0.3 * 2.8 + (3 - 0.15) * 0.15,
    4,
  )
  for (const geometry of geometries) geometry.dispose()
})

test('a solid retains its signed volume when placed above the ground datum', () => {
  const doc = specimen([[0, 0, 6000, 0, 300]])
  const geometry = built(doc, doc.walls.w1!)
  const before = volume(geometry)
  geometry.translate(10, 3, -5)
  expect(volume(geometry)).toBeCloseTo(before, 4)
  geometry.dispose()
})

test('an elevated wall carries the opening height measured from its base', () => {
  const doc = specimen([[0, 0, 6000, 0, 300]])
  const wall = doc.walls.w1!
  wall.baseOffset = 500
  wall.height = 2000
  doc.openings.o1 = {
    id: 'o1',
    wall: wall.id,
    t: 0.5,
    kind: 'window',
    variant: 'hinged',
    width: 1200,
    height: 1000,
    sillHeight: 500,
    hinge: 'a',
    swing: 1,
  }
  const geometry = built(doc, wall)
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }))
  mesh.position.y = 0.5
  mesh.updateMatrixWorld(true)
  expect(
    new Raycaster(new Vector3(3, 1.1, 1), new Vector3(0, 0, -1)).intersectObject(mesh),
  ).toHaveLength(0)
  expect(
    new Raycaster(new Vector3(3, 0.8, 1), new Vector3(0, 0, -1)).intersectObject(mesh).length,
  ).toBeGreaterThan(0)
  geometry.dispose()
  mesh.material.dispose()
})

test('an X junction partitions its shared volume exactly once', () => {
  const doc = specimen([
    [0, 0, 3000, 0, 300],
    [3000, 0, 6000, 0, 300],
    [3000, -3000, 3000, 0, 150],
    [3000, 0, 3000, 3000, 150],
  ])
  const geometries = Object.values(doc.walls).map((wall) => built(doc, wall))
  expect(geometries.reduce((sum, g) => sum + volume(g), 0)).toBeCloseTo(
    (6 * 0.3 + 6 * 0.15 - 0.3 * 0.15) * 2.8,
    4,
  )
  for (const geometry of geometries) geometry.dispose()
})
