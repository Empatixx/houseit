import type { Body } from '@houseit/scene/pieces'
import type { GeometryEngine } from '@thatopen/fragments'
import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from 'three'

export type PrimitiveBody = Extract<Body, { kind: 'box' | 'drum' | 'ball' }>
const MM = 0.001
const turn = Math.PI * 2
const swapYZ = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1)

export function primitiveGeometry(engine: GeometryEngine, body: PrimitiveBody) {
  const made = new BufferGeometry()
  if (body.kind === 'box') {
    const half = new Vector3(body.width, body.height, body.depth).multiplyScalar(MM / 2)
    engine.getBbox(made, { min: half.clone().negate(), max: half })
  } else {
    const profile: number[] = []
    if (body.kind === 'drum') {
      const low = (-body.height * MM) / 2,
        high = -low
      if (!body.open) profile.push(0, 0, high)
      profile.push(body.top * MM, 0, high, body.radius * MM, 0, low)
      if (!body.open) profile.push(0, 0, low, 0, 0, high)
    } else {
      for (let i = 0; i <= 14; i++) {
        const angle = (Math.PI * i) / 14
        profile.push(Math.sin(angle) * body.radius * MM, 0, -Math.cos(angle) * body.radius * MM)
      }
      profile.push(...profile.slice(0, 3))
    }
    engine.getRevolve(made, {
      profile,
      start: body.kind === 'ball' ? -90 : 0,
      end: body.kind === 'ball' ? 270 : 360,
      segmentCount: body.kind === 'ball' ? 19 : 29,
    })
    made.applyMatrix4(swapYZ)
    if (body.kind === 'drum') made.scale(1, 1, body.stretch)
  }
  if (body.kind !== 'drum') {
    const index = made.getIndex()!
    const p = made.getAttribute('position')
    for (let i = 0; i < index.count; i += 3) {
      if (body.kind === 'box') {
        const a = new Vector3().fromBufferAttribute(p, index.getX(i))
        const b = new Vector3().fromBufferAttribute(p, index.getX(i + 1))
        const c = new Vector3().fromBufferAttribute(p, index.getX(i + 2))
        if (b.sub(a).cross(c.sub(a)).dot(a) >= 0) continue
      }
      const a = index.getX(i)
      index.setX(i, index.getX(i + 2))
      index.setX(i + 2, a)
    }
  }
  const geometry = made.toNonIndexed()
  made.dispose()
  geometry.computeVertexNormals()
  const p = geometry.getAttribute('position'),
    n = geometry.getAttribute('normal')
  const uv = new Float32Array(p.count * 2)
  const normal = new Vector3()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i)
    let u: number, v: number
    if (body.kind === 'box') {
      const nx = n.getX(i),
        ny = n.getY(i),
        nz = n.getZ(i)
      u =
        (Math.abs(nx) > 0.5
          ? (-nx * z) / (body.depth * MM)
          : Math.abs(nz) > 0.5
            ? (nz * x) / (body.width * MM)
            : x / (body.width * MM)) + 0.5
      v = (Math.abs(ny) > 0.5 ? (-ny * z) / (body.depth * MM) : y / (body.height * MM)) + 0.5
    } else if (body.kind === 'ball') {
      normal.set(x, y, z).normalize()
      n.setXYZ(i, normal.x, normal.y, normal.z)
      const angle = Math.atan2(z, -x)
      u = (angle < 0 ? angle + turn : angle) / turn
      if (Math.hypot(x, z) < 1e-10) {
        const start = Math.floor(i / 3) * 3
        const adjacent = [start, start + 1, start + 2]
          .filter((j) => Math.hypot(p.getX(j), p.getZ(j)) > 1e-10)
          .map((j) => {
            const value = Math.atan2(p.getZ(j), -p.getX(j))
            return (value < 0 ? value + turn : value) / turn
          })
        if (Math.abs(adjacent[0]! - adjacent[1]!) > 0.5)
          adjacent[adjacent[0]! < adjacent[1]! ? 0 : 1]! += 1
        u = (adjacent[0]! + adjacent[1]!) / 2
      }
      v = Math.asin(Math.max(-1, Math.min(1, y / (body.radius * MM)))) / Math.PI + 0.5
    } else {
      const cap = Math.abs(n.getY(i)) > 0.999
      const radius = (y > 0 ? body.top : body.radius) * MM
      if (cap) {
        const sign = y > 0 ? 1 : -1
        u = z / body.stretch / (2 * radius) + 0.5
        v = (sign * x) / (2 * radius) + 0.5
      } else {
        let angle = Math.atan2(x, z / body.stretch)
        if (Math.hypot(x, z) < 1e-10) {
          const start = Math.floor(i / 3) * 3
          const angles = [start, start + 1, start + 2]
            .filter((j) => Math.hypot(p.getX(j), p.getZ(j)) > 1e-10)
            .map((j) => {
              const angle = Math.atan2(p.getX(j), p.getZ(j) / body.stretch)
              return angle < 0 ? angle + turn : angle
            })
          if (Math.abs(angles[0]! - angles[1]!) > Math.PI)
            angles[angles[0]! < angles[1]! ? 0 : 1]! += turn
          angle = y > 0 ? Math.max(...angles) : Math.min(...angles)
        }
        u = (angle < 0 ? angle + turn : angle) / turn
        v = y / (body.height * MM) + 0.5
        normal
          .set(
            Math.sin(angle),
            (body.radius - body.top) / body.height,
            Math.cos(angle) / body.stretch,
          )
          .normalize()
        n.setXYZ(i, normal.x, normal.y, normal.z)
      }
    }
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return geometry
}
