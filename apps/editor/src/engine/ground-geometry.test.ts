// @vitest-environment node
import { GeometryEngine } from '@thatopen/fragments'
import {
  type BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector3,
} from 'three'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { IfcAPI } from 'web-ifc'
import { groundGeometry } from './ground-geometry'

const api = new IfcAPI()
let engine: GeometryEngine
beforeAll(async () => {
  await api.Init(undefined, true)
  engine = new GeometryEngine(api)
})
afterAll(() => api.Dispose())

function triangles(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position'),
    indices = geometry.index
  const result: string[] = []
  for (let i = 0; i < (indices?.count ?? p.count); i += 3)
    result.push(
      [0, 1, 2]
        .map((n) => {
          const j = indices ? indices.getX(i + n) : i + n
          return [p.getX(j), p.getY(j), p.getZ(j)].join(',')
        })
        .sort()
        .join(';'),
    )
  return result.sort()
}

test('native ground cells retain the previous grid and triangle diagonals for vertex colours', () => {
  const geometry = groundGeometry(engine, { kind: 'ground', holes: [] })
  const previous = new PlaneGeometry(400, 400, 128, 128)
  try {
    expect(triangles(geometry)).toEqual(triangles(previous))
  } finally {
    geometry.dispose()
    previous.dispose()
  }
})

test('native ground profiles leave excavations open and retain the surrounding surface', () => {
  const geometry = groundGeometry(engine, {
    kind: 'ground',
    holes: [
      [
        { x: 0, z: 0 },
        { x: 2000, z: 0 },
        { x: 2000, z: -2000 },
        { x: 0, z: -2000 },
      ],
    ],
  })
  const material = new MeshBasicMaterial(),
    mesh = new Mesh(geometry, material)
  try {
    expect(
      new Raycaster(new Vector3(1, 1, 1), new Vector3(0, 0, -1)).intersectObject(mesh),
    ).toHaveLength(0)
    expect(
      new Raycaster(new Vector3(10, 10, 1), new Vector3(0, 0, -1)).intersectObject(mesh).length,
    ).toBeGreaterThan(0)
    let area = 0
    const p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(p, i)
      const b = new Vector3().fromBufferAttribute(p, i + 1).sub(a)
      const c = new Vector3().fromBufferAttribute(p, i + 2).sub(a)
      area += b.cross(c).z / 2
    }
    expect(area).toBeCloseTo(400 * 400 - 4, 5)
  } finally {
    geometry.dispose()
    material.dispose()
  }
})
