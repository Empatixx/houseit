import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { GeometryData } from './geometry-protocol'

export function geometryBuffer(data: GeometryData) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(data.uv, 2))
  for (const group of data.groups) geometry.addGroup(group.start, group.count, group.materialIndex)
  return geometry
}
