import type { GeometryEngine } from '@thatopen/fragments'
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { primitiveGeometry } from './primitive-geometry'
import type { WallBody } from './wall-body'

const MM = 0.001

export function wallGeometry(engine: GeometryEngine, body: WallBody): BufferGeometry {
  const geometry = new BufferGeometry()
  if (body.height <= 0) {
    geometry.setAttribute('position', new Float32BufferAttribute([], 3))
    geometry.setAttribute('normal', new Float32BufferAttribute([], 3))
    geometry.setAttribute('uv', new Float32BufferAttribute([], 2))
    return geometry
  }
  const parts = body.sections.map((section) => {
    const part = new BufferGeometry()
    const rectangular =
      section.profile.length === 4 &&
      section.profile.every(
        (p) =>
          (Math.abs(p.x) < 1e-6 || Math.abs(p.x - body.length) < 1e-6) &&
          Math.abs(Math.abs(p.z) - body.thickness / 2) < 1e-6,
      )
    if (rectangular) {
      engine.getWall(part, {
        start: [0, 0, 0],
        end: [body.length * MM, 0, 0],
        height: section.height * MM,
        thickness: body.thickness * MM,
      })
    } else {
      engine.getExtrusion(part, {
        profilePoints: [...section.profile, section.profile[0]!].flatMap((p) => [
          p.x * MM,
          0,
          p.z * MM,
        ]),
        direction: [0, 1, 0],
        length: section.height * MM,
        cap: true,
      })
    }
    const index = part.getIndex()!,
      points = part.getAttribute('position')
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
      if (!ids.every((id) => Math.abs(points.getY(id)) < 1e-7)) continue
      const [a, b, c] = ids as [number, number, number]
      const normalY =
        (points.getZ(b) - points.getZ(a)) * (points.getX(c) - points.getX(a)) -
        (points.getX(b) - points.getX(a)) * (points.getZ(c) - points.getZ(a))
      if (normalY > 0) {
        index.setX(i + 1, c)
        index.setX(i + 2, b)
      }
    }
    part.translate(0, section.base * MM, 0)
    return new Mesh(part, new MeshBasicMaterial())
  })
  try {
    for (const part of parts) {
      const cuts = body.openings
        .filter((o) => o.base < body.height && o.base + o.height > 0)
        .map((o) => {
          const cut = new Mesh(
            primitiveGeometry(engine, {
              kind: 'box',
              width: o.width,
              height: o.height,
              depth: body.thickness + 20,
            }),
            new MeshBasicMaterial(),
          )
          cut.geometry.setIndex(
            Array.from({ length: cut.geometry.getAttribute('position').count }, (_, i) => i),
          )
          cut.position.set(o.at * MM, (o.base + o.height / 2) * MM, 0)
          cut.updateMatrixWorld(true)
          return cut
        })
      if (!cuts.length) continue
      const cut = new BufferGeometry()
      try {
        engine.getBooleanOperation(cut, { type: 'DIFFERENCE', target: part, operands: cuts })
        part.geometry.copy(cut)
      } finally {
        cut.dispose()
        for (const mesh of cuts) {
          mesh.geometry.dispose()
          mesh.material.dispose()
        }
      }
    }
    const merged = mergeGeometries(parts.map((p) => p.geometry))
    if (!merged) throw new Error('Cannot combine wall height bands')
    geometry.copy(merged)
    merged.dispose()
  } finally {
    for (const part of parts) {
      part.geometry.dispose()
      part.material.dispose()
    }
  }
  const flat = geometry.toNonIndexed()
  geometry.dispose()
  flat.computeVertexNormals()
  const positions = flat.getAttribute('position'),
    normals = flat.getAttribute('normal')
  const uv: number[] = []
  for (let i = 0; i < positions.count; i++) {
    uv.push(positions.getX(i) / (body.length * MM), positions.getY(i) / (body.height * MM))
    if (i % 3 === 0) {
      const material = normals.getZ(i) > 0 ? 1 : 0
      const last = flat.groups.at(-1)
      if (last?.materialIndex === material) last.count += 3
      else flat.addGroup(i, 3, material)
    }
  }
  flat.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  flat.computeBoundingBox()
  flat.computeBoundingSphere()
  return flat
}
