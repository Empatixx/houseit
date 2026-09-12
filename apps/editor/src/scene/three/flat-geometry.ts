import type { Body, Corner } from '@houseit/scene/pieces'
import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ShapeGeometry,
} from 'three'
import { MM } from '../plan-coordinates'

export function flatGeometry(body: Extract<Body, { kind: 'prism' | 'sheet' }>): BufferGeometry {
  const shape = shapeOf(body.outline, body.holes)
  let geometry: BufferGeometry =
    body.kind === 'prism'
      ? new ExtrudeGeometry(shape, { depth: body.thickness * MM, bevelEnabled: false })
      : new ShapeGeometry(shape)
  if (body.kind === 'prism' && body.top !== undefined)
    geometry = replaceTop(geometry, body.top, body.thickness * MM)
  if (body.kind === 'prism' && body.slope) {
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i += 1) {
      positions.setZ(
        i,
        positions.getZ(i) +
          (body.slope.both ? 1 : positions.getZ(i) / (body.thickness * MM)) *
            (positions.getX(i) * body.slope.x -
              positions.getY(i) * body.slope.z +
              body.slope.offset * MM),
      )
    }
    geometry.computeVertexNormals()
  }
  return geometry
}

function shapeOf(outline: Corner[], holes: Corner[][]): Shape {
  const shape = new Shape()
  outline.forEach((corner, index) => {
    if (index === 0) shape.moveTo(corner.x * MM, -corner.z * MM)
    else shape.lineTo(corner.x * MM, -corner.z * MM)
  })
  shape.closePath()
  for (const ring of holes) {
    const hole = new Path()
    ring.forEach((corner, index) => {
      if (index === 0) hole.moveTo(corner.x * MM, -corner.z * MM)
      else hole.lineTo(corner.x * MM, -corner.z * MM)
    })
    hole.closePath()
    shape.holes.push(hole)
  }
  return shape
}

function replaceTop(original: BufferGeometry, top: Corner[][], depth: number): BufferGeometry {
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = []
  const groups: { start: number; count: number; materialIndex: number }[] = []
  const append = (geometry: BufferGeometry, cap: boolean) => {
    const p = geometry.getAttribute('position'),
      n = geometry.getAttribute('normal'),
      uv = geometry.getAttribute('uv')
    const index = geometry.getIndex()
    const count = index?.count ?? p.count
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j))
      if (!cap && ids.every((j) => n.getZ(j) > 0.99 && Math.abs(p.getZ(j) - depth) < 1e-5)) continue
      const materialIndex = cap || Math.abs(n.getZ(ids[0]!)) > 0.99 ? 0 : 1
      const last = groups.at(-1)
      if (last?.materialIndex === materialIndex) last.count += 3
      else groups.push({ start: positions.length / 3, count: 3, materialIndex })
      for (const j of ids) {
        positions.push(p.getX(j), p.getY(j), cap ? depth : p.getZ(j))
        normals.push(n.getX(j), n.getY(j), n.getZ(j))
        uvs.push(uv.getX(j), uv.getY(j))
      }
    }
  }
  append(original, false)
  const cap = new ShapeGeometry(top.map((ring) => shapeOf(ring, [])))
  append(cap, true)
  original.dispose()
  cap.dispose()
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  for (const g of groups) geometry.addGroup(g.start, g.count, g.materialIndex)
  return geometry
}
