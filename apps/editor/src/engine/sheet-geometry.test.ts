// @vitest-environment node
import { GeometryEngine } from '@thatopen/fragments'
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { IfcAPI } from 'web-ifc'
import { sheetGeometry } from './sheet-geometry'

const api = new IfcAPI()
let engine: GeometryEngine
beforeAll(async () => {
  await api.Init(undefined, true)
  engine = new GeometryEngine(api)
})
afterAll(() => api.Dispose())

const rectangle = (x: number, y: number, width: number, depth: number) => [
  { x, z: -y },
  { x: x + width, z: -y },
  { x: x + width, z: -y - depth },
  { x, z: -y - depth },
]

test('combined native plan profiles retain holes, separate regions and symbol UVs', () => {
  const geometry = sheetGeometry(engine, {
    kind: 'sheets',
    profiles: [
      { outline: rectangle(0, 0, 4000, 3000), holes: [rectangle(1000, 1000, 1000, 1000)] },
      { outline: rectangle(5000, 0, 2000, 1000), holes: [] },
    ],
    textureSize: { width: 4000, depth: 3000 },
  })
  const material = new MeshBasicMaterial()
  const mesh = new Mesh(geometry, material)
  try {
    const p = geometry.getAttribute('position'),
      uv = geometry.getAttribute('uv')
    let area = 0
    for (let i = 0; i < p.count; i++) {
      expect(uv.getX(i)).toBeCloseTo(p.getX(i) / 4 + 0.5)
      expect(uv.getY(i)).toBeCloseTo(p.getY(i) / 3 + 0.5)
      if (i % 3 === 0)
        area +=
          new Vector3()
            .fromBufferAttribute(p, i + 1)
            .sub(new Vector3().fromBufferAttribute(p, i))
            .cross(
              new Vector3()
                .fromBufferAttribute(p, i + 2)
                .sub(new Vector3().fromBufferAttribute(p, i)),
            ).z / 2
    }
    expect(area).toBeCloseTo(13)
    for (const [x, y, hit] of [
      [0.5, 0.5, true],
      [1.5, 1.5, false],
      [4.5, 0.5, false],
      [6, 0.5, true],
    ] as const)
      expect(
        new Raycaster(new Vector3(x, y, 1), new Vector3(0, 0, -1)).intersectObject(mesh).length > 0,
      ).toBe(hit)
  } finally {
    geometry.dispose()
    material.dispose()
  }
})

test('an empty native profile collection remains a valid empty surface', () => {
  const geometry = sheetGeometry(engine, { kind: 'sheets', profiles: [] })
  for (const name of ['position', 'normal', 'uv']) expect(geometry.getAttribute(name).count).toBe(0)
  geometry.dispose()
})
