import type { BufferGeometry, Matrix4 } from 'three'
import { Float32BufferAttribute, Matrix3, Vector3 } from 'three'
import type { TileSurface } from './display-surface'

type Triangle = {
  points: Vector3[]
  uv: number[][]
  normals: Vector3[]
  colours?: Vector3[]
  material: number
}
type Index = { exact: Map<string, Triangle[]>; nearby: Map<string, Triangle[]> }
const cache = new WeakMap<BufferGeometry, Index>()
const centreOf = (points: Vector3[]) =>
  points
    .reduce((sum, p) => sum.add(p), new Vector3())
    .multiplyScalar(1000 / 3)
    .floor()
const cell = (p: Vector3) => `${p.x},${p.y},${p.z}`
const offsets = Array.from(
  { length: 27 },
  (_, i) => new Vector3((i % 3) - 1, (Math.floor(i / 3) % 3) - 1, Math.floor(i / 9) - 1),
)
const keyOf = (points: Vector3[]) =>
  points
    .map((p) => [p.x, p.y, p.z].map((n) => Math.round(n * 10000)).join(','))
    .sort()
    .join(';')
function triangles(geometry: BufferGeometry) {
  const cached = cache.get(geometry)
  if (cached) return cached
  const map = new Map<string, Triangle[]>(),
    nearby = new Map<string, Triangle[]>()
  const position = geometry.getAttribute('position'),
    uv = geometry.getAttribute('uv'),
    normal = geometry.getAttribute('normal'),
    colour = geometry.getAttribute('color'),
    index = geometry.index
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const ids = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j))
    const points = ids.map((id) => new Vector3().fromBufferAttribute(position, id))
    const triangle = {
      points,
      normals: ids.map((id) => new Vector3().fromBufferAttribute(normal, id)),
      colours: colour ? ids.map((id) => new Vector3().fromBufferAttribute(colour, id)) : undefined,
      uv: ids.map((id) => (uv ? [uv.getX(id), uv.getY(id)] : [0, 0])),
      material:
        geometry.groups.find((g) => i >= g.start && i < g.start + g.count)?.materialIndex ?? 0,
    }
    const key = keyOf(points)
    const list = map.get(key) ?? []
    list.push(triangle)
    map.set(key, list)
    const location = cell(centreOf(points)),
      neighbours = nearby.get(location) ?? []
    neighbours.push(triangle)
    nearby.set(location, neighbours)
  }
  const lookup = { exact: map, nearby }
  cache.set(geometry, lookup)
  return lookup
}
export function restoreSourceAppearance(
  geometry: BufferGeometry,
  matrix: Matrix4,
  vertices: TileSurface[],
  uv: Float32Array,
  sides: number[],
) {
  const position = geometry.getAttribute('position'),
    normal = geometry.getAttribute('normal'),
    index = geometry.index!
  const inverses = new Map<TileSurface, Matrix4>()
  const colours = vertices.some(
    (v) => v.surface.mapping.kind === 'source' && v.surface.mapping.geometry.hasAttribute('color'),
  )
    ? new Float32BufferAttribute(new Float32Array(position.count * 3).fill(1), 3)
    : undefined
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    const entry = vertices[ids[0]!]!,
      mapping = entry.surface.mapping
    if (mapping.kind !== 'source') continue
    let inverse = inverses.get(entry)
    if (!inverse) {
      inverse = entry.surface.transform.clone().invert().multiply(matrix)
      inverses.set(entry, inverse)
    }
    const points = ids.map((id) =>
      new Vector3().fromBufferAttribute(position, id).applyMatrix4(inverse),
    )
    const source = triangles(mapping.geometry)
    const matches =
      source.exact.get(keyOf(points)) ??
      offsets
        .flatMap((offset) => source.nearby.get(cell(centreOf(points).add(offset))) ?? [])
        .filter((triangle) =>
          points.every((point) =>
            triangle.points.some((candidate) => point.distanceToSquared(candidate) < 1e-8),
          ),
        )
    if (!matches?.length)
      throw new Error(`Cannot restore native surface appearance: ${entry.surface.id}`)
    const triangle = matches[0]!
    const normalTransform = new Matrix3().getNormalMatrix(inverse.clone().invert())
    for (let j = 0; j < 3; j++) {
      let corner = 0
      for (let k = 1; k < 3; k++)
        if (
          points[j]!.distanceToSquared(triangle.points[k]!) <
          points[j]!.distanceToSquared(triangle.points[corner]!)
        )
          corner = k
      uv[2 * ids[j]!] = triangle.uv[corner]![0]!
      uv[2 * ids[j]! + 1] = triangle.uv[corner]![1]!
      sides[ids[j]!] = triangle.material
      const n = triangle.normals[corner]!.clone().applyMatrix3(normalTransform).normalize()
      normal.setXYZ(ids[j]!, n.x, n.y, n.z)
      const colour = triangle.colours?.[corner]
      if (colour) colours?.setXYZ(ids[j]!, colour.x, colour.y, colour.z)
    }
  }
  normal.needsUpdate = true
  if (colours) geometry.setAttribute('color', colours)
}
