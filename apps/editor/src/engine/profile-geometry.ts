import type { Body, Corner } from '@houseit/scene/pieces'
import type { GeometryEngine } from '@thatopen/fragments'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type ProfileBody = Extract<Body, { kind: 'prism' | 'sheet' }>
const MM = 0.001

function ring(corners: Corner[], clockwise: boolean, height: (x: number, y: number) => number) {
  const points = corners.map((p) => [p.x * MM, -p.z * MM] as const)
  const area = points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length]!
    return sum + p[0] * next[1] - next[0] * p[1]
  }, 0)
  if (area < 0 !== clockwise) points.reverse()
  return [...points, points[0]!].flatMap(([x, y]) => [x, y, height(x, y)])
}

export function profileGeometry(engine: GeometryEngine, body: ProfileBody): BufferGeometry {
  const prism = body.kind === 'prism'
  const depth = prism ? body.thickness * MM : 1
  const slope = prism ? body.slope : undefined
  const topCut = slope && !slope.both
  const rise = (x: number, y: number) => (slope ? x * slope.x - y * slope.z + slope.offset * MM : 0)
  const base = (x: number, y: number) => (topCut ? depth : slope ? rise(x, y) : 0)
  const geometry = new BufferGeometry()
  engine.getExtrusion(geometry, {
    profilePoints: ring(body.outline, false, base),
    profileHoles: body.holes.map((hole) => ring(hole, true, base)),
    direction: [0, 0, topCut ? -1 : 1],
    length: depth,
    cap: true,
    ...(topCut
      ? {
          cuttingPlaneNormal: [-slope.x, slope.z, 1],
          cuttingPlanePosition: [0, 0, depth + slope.offset * MM],
        }
      : {}),
  })
  const positions = geometry.getAttribute('position')
  const index = geometry.getIndex()!
  const kept: number[] = []
  const groups: { start: number; count: number; materialIndex: number }[] = []
  const uv = new Float32Array(positions.count * 2)
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    if (topCut) ids.reverse()
    const onTop = ids.every(
      (j) =>
        Math.abs(positions.getZ(j) - depth - rise(positions.getX(j), positions.getY(j))) < 1e-5,
    )
    const onBottom = ids.every(
      (j) =>
        Math.abs(
          positions.getZ(j) - (slope?.both ? rise(positions.getX(j), positions.getY(j)) : 0),
        ) < 1e-5,
    )
    if ((!prism && !onTop) || (prism && body.top !== undefined && onTop)) continue
    const cap = onTop || onBottom
    const materialIndex = cap ? 0 : 1
    const previous = groups.at(-1)
    if (previous?.materialIndex === materialIndex) previous.count += 3
    else groups.push({ start: kept.length, count: 3, materialIndex })
    kept.push(...ids)
    const a = ids[0]!,
      b = ids[1]!,
      c = ids[2]!
    const horizontal =
      Math.max(positions.getY(a), positions.getY(b), positions.getY(c)) -
        Math.min(positions.getY(a), positions.getY(b), positions.getY(c)) <
      0.01
    for (const j of ids) {
      const x = positions.getX(j),
        y = positions.getY(j)
      const originalZ = onTop
        ? depth
        : onBottom
          ? 0
          : (positions.getZ(j) - (slope?.both ? rise(x, y) : 0)) /
            (topCut ? (depth + rise(x, y)) / depth : 1)
      uv[j * 2] = cap || horizontal ? x : y
      uv[j * 2 + 1] = cap ? y : 1 - originalZ
    }
  }
  geometry.setIndex(kept)
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex)
  const flat = geometry.toNonIndexed()
  geometry.dispose()
  if (!prism) flat.translate(0, 0, -1)
  flat.computeVertexNormals()
  if (prism && body.top !== undefined) {
    const parts = [flat]
    try {
      for (const outline of body.top) {
        const cap = profileGeometry(engine, { kind: 'sheet', outline, holes: [] })
        const points = cap.getAttribute('position')
        for (let i = 0; i < points.count; i++)
          points.setZ(i, depth + rise(points.getX(i), points.getY(i)))
        cap.computeVertexNormals()
        parts.push(cap)
      }
      const result = mergeGeometries(parts)
      if (!result) throw new Error('Cannot combine native profile surfaces')
      for (const group of flat.groups)
        result.addGroup(group.start, group.count, group.materialIndex)
      result.addGroup(
        flat.getAttribute('position').count,
        result.getAttribute('position').count - flat.getAttribute('position').count,
        0,
      )
      return result
    } finally {
      for (const part of parts) part.dispose()
    }
  }
  return flat
}
