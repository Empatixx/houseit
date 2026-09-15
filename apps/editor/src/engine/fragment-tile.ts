import {
  type BufferAttribute,
  type BufferGeometry,
  Float32BufferAttribute,
  type InterleavedBufferAttribute,
  type Material,
  Matrix3,
  type Matrix4,
  type Mesh,
  Vector3,
} from 'three'
import type { TileSurface } from './display-surface'
import { restoreSourceAppearance } from './source-appearance'

export function tileItemIds(ids: BufferAttribute | InterleavedBufferAttribute) {
  return Array.from(
    { length: ids.count },
    (_, i) => ids.getX(i) * 16777216 + ids.getY(i) * 65536 + ids.getZ(i) * 256 + ids.getW(i) - 1,
  )
}

export function mapFragmentTile(
  geometry: BufferGeometry,
  matrix: Matrix4,
  vertices: TileSurface[],
) {
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const uv = new Float32Array(positions.count * 2)
  const sides: number[] = []
  const point = new Vector3(),
    normal = new Vector3()
  const transforms = new Map(
    [...new Set(vertices)].map((entry) => {
      const inverse = entry!.surface.transform.clone().invert().multiply(matrix)
      return [entry, { inverse, normal: new Matrix3().getNormalMatrix(inverse) }]
    }),
  )
  for (let i = 0; i < positions.count; i++) {
    const entry = vertices[i]!,
      transform = transforms.get(entry)!
    point.fromBufferAttribute(positions, i).applyMatrix4(transform.inverse)
    normal.fromBufferAttribute(normals, i).applyMatrix3(transform.normal)
    const mapping = entry.surface.mapping
    if (mapping.kind === 'wall') {
      uv[2 * i] = point.x / (mapping.length / 1000)
      uv[2 * i + 1] = point.y / (mapping.height / 1000)
      sides.push(normal.z > 0.0001 ? 1 : 0)
    } else if (mapping.kind === 'flat') {
      const cap = Math.abs(normal.z) > 0.99
      uv[2 * i] = cap || Math.abs(normal.x) < Math.abs(normal.y) ? point.x : point.y
      uv[2 * i + 1] = cap ? point.y : 1 - point.z
      sides.push(cap ? 0 : 1)
    } else sides.push(0)
  }
  restoreSourceAppearance(geometry, matrix, vertices, uv, sides)
  geometry.userData.houseitSides = sides
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))

  geometry.userData.houseitSurface = vertices
}

export function styleFragmentTile(object: Mesh) {
  const geometry = object.geometry as BufferGeometry
  const entries = geometry.userData.houseitSurface as TileSurface[] | undefined
  if (!entries) return
  const sides = geometry.userData.houseitSides as number[]
  const materials: Material[] = []
  const visible = geometry.groups.map((group) => ({
    start: group.start,
    end: Math.min(geometry.index!.count, group.start + group.count),
  }))
  geometry.clearGroups()
  for (const range of visible)
    for (let i = range.start; i < range.end; i += 3) {
      const vertex = geometry.index!.getX(i)
      const appearance = entries[vertex]!.surface
      const material = appearance.materials[appearance.materials.length === 1 ? 0 : sides[vertex]!]!
      let index = materials.indexOf(material)
      if (index < 0) {
        index = materials.length
        materials.push(material)
      }
      const last = geometry.groups.at(-1)
      if (last?.materialIndex === index && last.start + last.count === i) last.count += 3
      else geometry.addGroup(i, 3, index)
    }
  const single = materials.length === 1 && geometry.groups.length === 1
  const range = single
    ? geometry.groups[0]!
    : { start: 0, count: geometry.groups.length ? geometry.index!.count : 0 }
  geometry.setDrawRange(range.start, range.count)
  object.material = single ? materials[0]! : materials
}
