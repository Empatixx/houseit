// @vitest-environment node

import { exposedBoxes } from '@houseit/scene/exposed-boxes'
import { slab } from '@houseit/scene/pieces'
import { GeometryEngine } from '@thatopen/fragments'
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SphereGeometry,
  Vector3,
} from 'three'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { IfcAPI } from 'web-ifc'
import { type PrimitiveBody, primitiveGeometry } from './primitive-geometry'

const api = new IfcAPI()
let engine: GeometryEngine
beforeAll(async () => {
  await api.Init(undefined, true)
  engine = new GeometryEngine(api)
})
afterAll(() => api.Dispose())

const bodies: PrimitiveBody[] = [
  { kind: 'box', width: 1200, height: 800, depth: 500 },
  { kind: 'drum', radius: 500, top: 500, height: 1200, open: false, stretch: 1 },
  { kind: 'drum', radius: 500, top: 250, height: 1200, open: false, stretch: 1 },
  { kind: 'drum', radius: 500, top: 300, height: 1200, open: true, stretch: 1.5 },
  { kind: 'drum', radius: 500, top: 0, height: 1200, open: false, stretch: 1 },
  { kind: 'ball', radius: 750 },
]

function legacy(body: PrimitiveBody): BufferGeometry {
  if (body.kind === 'box')
    return new BoxGeometry(body.width / 1000, body.height / 1000, body.depth / 1000)
  if (body.kind === 'ball') return new SphereGeometry(body.radius / 1000, 18, 14)
  return new CylinderGeometry(
    body.top / 1000,
    body.radius / 1000,
    body.height / 1000,
    28,
    1,
    body.open,
  ).scale(1, 1, body.stretch)
}

function volume(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position'),
    index = geometry.getIndex()
  let result = 0
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const [a, b, c] = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j),
    )
    result += a!.dot(b!.cross(c!)) / 6
  }
  return result
}

test.each(bodies)(
  'native $kind preserves the previous silhouette, surface normals and texture coordinates',
  (body) => {
    const native = primitiveGeometry(engine, body),
      before = legacy(body)
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const made = new Mesh(native, material),
      original = new Mesh(before, material)
    before.computeBoundingBox()
    native.computeBoundingBox()
    expect(native.boundingBox!.min.distanceTo(before.boundingBox!.min)).toBeLessThan(1e-6)
    expect(native.boundingBox!.max.distanceTo(before.boundingBox!.max)).toBeLessThan(1e-6)
    for (const attribute of Object.values(native.attributes))
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
    const box = before.boundingBox!,
      size = box.getSize(new Vector3())
    let checked = 0
    for (let axis = 0; axis < 3; axis++)
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++) {
          const at = box.min.clone()
          at.setComponent(axis, box.max.getComponent(axis) + 1)
          at.setComponent(
            (axis + 1) % 3,
            box.min.getComponent((axis + 1) % 3) +
              (size.getComponent((axis + 1) % 3) * (a + 0.37)) / 3,
          )
          at.setComponent(
            (axis + 2) % 3,
            box.min.getComponent((axis + 2) % 3) +
              (size.getComponent((axis + 2) % 3) * (b + 0.41)) / 3,
          )
          const ray = new Raycaster(at, new Vector3().setComponent(axis, -1))
          const actual = ray.intersectObject(made),
            expected = ray.intersectObject(original)
          expect(actual.length).toBe(expected.length)
          for (let i = 0; i < actual.length; i++) {
            expect(actual[i]!.point.distanceTo(expected[i]!.point)).toBeLessThan(1e-6)
            expect(
              actual[i]!.normal!.distanceTo(expected[i]!.normal!),
              JSON.stringify({
                body,
                point: actual[i]!.point,
                actual: actual[i]!.normal,
                expected: expected[i]!.normal,
              }),
            ).toBeLessThan(0.001)
            expect(
              actual[i]!.uv!.distanceTo(expected[i]!.uv!),
              JSON.stringify({
                point: actual[i]!.point,
                actual: actual[i]!.uv,
                expected: expected[i]!.uv,
                normal: actual[i]!.face!.normal,
              }),
            ).toBeLessThan(0.001)
            checked++
          }
        }
    expect(checked).toBeGreaterThan(10)
    if (body.kind !== 'drum' || !body.open) {
      expect(volume(native)).toBeCloseTo(volume(before), 5)
      const moved = native.clone().translate(10, 7, -3)
      expect(volume(moved)).toBeCloseTo(volume(before), 4)
      moved.dispose()
    }
    native.dispose()
    before.dispose()
    material.dispose()
  },
)

test('native face profiles preserve a joined and rotated box skin without internal faces', () => {
  const pieces = exposedBoxes([
    slab({ w: 4000, h: 3000, d: 1000, paint: { colour: '#ffffff' } }),
    slab({ w: 4000, h: 3000, d: 1000, turn: Math.PI / 2, paint: { colour: '#ffffff' } }),
  ])
  let area = 0,
    totalVolume = 0
  for (const piece of pieces) {
    if (piece.body.kind !== 'box') throw Error('Expected a box')
    const geometry = primitiveGeometry(engine, piece.body)
    geometry.rotateY(piece.turn ?? 0).translate(5, 2, 7)
    totalVolume += volume(geometry)
    const p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(p, i)
      const b = new Vector3().fromBufferAttribute(p, i + 1)
      const c = new Vector3().fromBufferAttribute(p, i + 2)
      area += b.sub(a).cross(c.sub(a)).length() / 2
    }
    geometry.dispose()
  }
  expect(area).toBeCloseTo(62)
  expect(totalVolume).toBeCloseTo(21)
})

test('a completely covered native box contributes no geometry', () => {
  const first = slab({ w: 2000, h: 2000, d: 2000, paint: { colour: '#ffffff' } })
  const hidden = exposedBoxes([first, first])[1]!
  if (hidden.body.kind !== 'box') throw Error('Expected a box')
  const geometry = primitiveGeometry(engine, hidden.body)
  expect(geometry.getAttribute('position').count).toBe(0)
  geometry.dispose()
})
