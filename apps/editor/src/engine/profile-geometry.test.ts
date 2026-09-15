// @vitest-environment node
import { GeometryEngine } from '@thatopen/fragments'
import { type BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { IfcAPI } from 'web-ifc'
import { type ProfileBody, profileGeometry } from './profile-geometry'

const api = new IfcAPI()
let engine: GeometryEngine
beforeAll(async () => {
  await api.Init(undefined, true)
  engine = new GeometryEngine(api)
})
afterAll(() => api.Dispose())

const outline = [
  { x: 0, z: 0 },
  { x: 4000, z: 0 },
  { x: 4000, z: -3000 },
  { x: 0, z: -3000 },
]
const hole = [
  { x: 1000, z: -1000 },
  { x: 2000, z: -1000 },
  { x: 2000, z: -2000 },
  { x: 1000, z: -2000 },
]
const slab: ProfileBody = { kind: 'prism', outline, holes: [], thickness: 200 }

function volume(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position')
  let sum = 0
  for (let i = 0; i < p.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(p, i)
    const b = new Vector3().fromBufferAttribute(p, i + 1)
    const c = new Vector3().fromBufferAttribute(p, i + 2)
    sum += a.dot(b.cross(c)) / 6
  }
  return sum
}

test.each([false, true])(
  'native slab subtracts a through hole independently of ring winding (%s)',
  (reverse) => {
    const geometry = profileGeometry(engine, {
      ...slab,
      outline: reverse ? [...outline].reverse() : outline,
      holes: [reverse ? [...hole].reverse() : hole],
    })
    expect(volume(geometry)).toBeCloseTo(11 * 0.2, 5)
    geometry.translate(10, 7, -4)
    expect(volume(geometry)).toBeCloseTo(11 * 0.2, 4)
    geometry.translate(-10, -7, 4)
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }))
    expect(
      new Raycaster(new Vector3(1.5, 1.5, 2), new Vector3(0, 0, -1)).intersectObject(mesh),
    ).toHaveLength(0)
    expect(
      new Raycaster(new Vector3(0.5, 0.5, 2), new Vector3(0, 0, -1)).intersectObject(mesh).length,
    ).toBeGreaterThan(0)
    geometry.dispose()
    mesh.material.dispose()
  },
)

test.each([false, true])(
  'native sloping profile retains its cap heights and signed volume (both=%s)',
  (both) => {
    const geometry = profileGeometry(engine, {
      ...slab,
      slope: { x: 0.1, z: 0, offset: 100, both },
    })
    expect(volume(geometry)).toBeCloseTo(12 * (both ? 0.2 : 0.5), 5)
    const p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const rise = p.getX(i) * 0.1 + 0.1
      expect(
        Math.min(Math.abs(p.getZ(i) - rise - 0.2), Math.abs(p.getZ(i) - (both ? rise : 0))),
      ).toBeLessThan(1e-6)
    }
    geometry.translate(10, -3, 8)
    expect(volume(geometry)).toBeCloseTo(12 * (both ? 0.2 : 0.5), 4)
    geometry.dispose()
  },
)

test('native sheet contains one upward cap, retains its opening and metric texture coordinates', () => {
  const geometry = profileGeometry(engine, { kind: 'sheet', outline, holes: [hole] })
  const p = geometry.getAttribute('position'),
    n = geometry.getAttribute('normal'),
    uv = geometry.getAttribute('uv')
  let area = 0
  for (let i = 0; i < p.count; i++) {
    expect(p.getZ(i)).toBe(0)
    expect(n.getZ(i)).toBeCloseTo(1)
    expect(uv.getX(i)).toBeCloseTo(p.getX(i))
    expect(uv.getY(i)).toBeCloseTo(p.getY(i))
    if (i % 3 === 0)
      area +=
        ((p.getX(i + 1) - p.getX(i)) * (p.getY(i + 2) - p.getY(i)) -
          (p.getY(i + 1) - p.getY(i)) * (p.getX(i + 2) - p.getX(i))) /
        2
  }
  expect(area).toBeCloseTo(11)
  geometry.dispose()
})

test('native extrusion preserves a concave outline and replacement top regions', () => {
  const ring = [
    { x: 0, z: 0 },
    { x: 4000, z: 0 },
    { x: 4000, z: -1000 },
    { x: 1000, z: -1000 },
    { x: 1000, z: -3000 },
    { x: 0, z: -3000 },
  ]
  const geometry = profileGeometry(engine, { ...slab, outline: ring, top: [ring] })
  expect(volume(geometry)).toBeCloseTo(6 * 0.2, 5)
  expect(geometry.groups.some((g) => g.materialIndex === 1)).toBe(true)
  expect(geometry.groups.reduce((sum, g) => sum + g.count, 0)).toBe(
    geometry.getAttribute('position').count,
  )
  geometry.dispose()
})
