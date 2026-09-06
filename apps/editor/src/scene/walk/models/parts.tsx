import type { ReactNode } from 'react'
import { MM } from '../../plan-coordinates'
import type { Paint } from '../finish'

export type Part = {
  w: number
  d: number
  h: number
  body: Paint
  frame: Paint
}

export type Builder = (part: Part) => ReactNode

export const along = (count: number, at: (i: number) => number): number[] =>
  Array.from({ length: count }, (_, i) => at(i))

export function Finish({ paint }: { paint: Paint }) {
  return (
    <meshLambertMaterial
      color={paint.color}
      map={paint.map}
      transparent={paint.transparent}
      opacity={paint.opacity ?? 1}
      depthWrite={!paint.transparent}
    />
  )
}

export type SlabProps = {
  x?: number
  z?: number
  base?: number
  w: number
  h: number
  d: number
  paint: Paint
  turn?: number
}

export function Slab({ x = 0, z = 0, base = 0, w, h, d, paint, turn = 0 }: SlabProps) {
  return (
    <mesh position={[x * MM, (base + h / 2) * MM, z * MM]} rotation={[0, turn, 0]}>
      <boxGeometry args={[w * MM, h * MM, d * MM]} />
      <Finish paint={paint} />
    </mesh>
  )
}

export type LeanProps = {
  x?: number
  from: [number, number]
  to: [number, number]
  w: number
  thick: number
  paint: Paint
}

export function Lean({ x = 0, from, to, w, thick, paint }: LeanProps) {
  const dz = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dz, dy)
  return (
    <mesh
      position={[x * MM, ((from[1] + to[1]) / 2) * MM, ((from[0] + to[0]) / 2) * MM]}
      rotation={[Math.atan2(dz, dy), 0, 0]}
    >
      <boxGeometry args={[w * MM, length * MM, thick * MM]} />
      <Finish paint={paint} />
    </mesh>
  )
}

export type DrumProps = {
  x?: number
  z?: number
  base?: number
  r: number
  top?: number
  h: number
  paint: Paint
  stretch?: number
  open?: boolean
}

export function Drum({
  x = 0,
  z = 0,
  base = 0,
  r,
  top,
  h,
  paint,
  stretch = 1,
  open = false,
}: DrumProps) {
  return (
    <mesh position={[x * MM, (base + h / 2) * MM, z * MM]} scale={[1, 1, stretch]}>
      <cylinderGeometry args={[(top ?? r) * MM, r * MM, h * MM, 28, 1, open]} />
      <Finish paint={paint} />
    </mesh>
  )
}

export type DiscProps = {
  x?: number
  y: number
  z?: number
  r: number
  thick: number
  paint: Paint
  facing?: 'front' | 'side'
}

export function Disc({ x = 0, y, z = 0, r, thick, paint, facing = 'front' }: DiscProps) {
  const rotation: [number, number, number] =
    facing === 'front' ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]
  return (
    <mesh position={[x * MM, y * MM, z * MM]} rotation={rotation}>
      <cylinderGeometry args={[r * MM, r * MM, thick * MM, 28]} />
      <Finish paint={paint} />
    </mesh>
  )
}

export function Ball({
  x = 0,
  y,
  z = 0,
  r,
  paint,
}: {
  x?: number
  y: number
  z?: number
  r: number
  paint: Paint
}) {
  return (
    <mesh position={[x * MM, y * MM, z * MM]}>
      <sphereGeometry args={[r * MM, 18, 14]} />
      <Finish paint={paint} />
    </mesh>
  )
}

export type LegsProps = {
  w: number
  d: number
  h: number
  inset?: number
  thick?: number
  paint: Paint
  x?: number
  z?: number
}

export function Legs({ w, d, h, inset = 60, thick = 50, paint, x = 0, z = 0 }: LegsProps) {
  const dx = w / 2 - inset - thick / 2
  const dz = d / 2 - inset - thick / 2
  return (
    <>
      {[-dx, dx].map((lx) =>
        [-dz, dz].map((lz) => (
          <Slab key={`${lx}:${lz}`} x={x + lx} z={z + lz} h={h} w={thick} d={thick} paint={paint} />
        )),
      )}
    </>
  )
}

export function Put({
  x = 0,
  z = 0,
  turn = 0,
  children,
}: {
  x?: number
  z?: number
  turn?: number
  children: ReactNode
}) {
  return (
    <group position={[x * MM, 0, z * MM]} rotation={[0, turn, 0]}>
      {children}
    </group>
  )
}

export function cabinet(part: Part, columns = 1, rows = 1, height = part.h): ReactNode {
  const { w, d, body, frame } = part
  const handles: ReactNode[] = []
  for (let c = 0; c < columns; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      handles.push(
        <Slab
          key={`${c}:${r}`}
          x={-w / 2 + ((c + 0.5) * w) / columns}
          z={-d / 2 - 10}
          base={60 + ((r + 0.5) * (height - 60)) / rows}
          h={18}
          w={Math.min(160, w / columns - 80)}
          d={20}
          paint={frame}
        />,
      )
    }
  }
  return (
    <>
      <Slab h={60} w={w - 80} d={d - 80} paint={frame} />
      <Slab base={60} h={height - 60} w={w} d={d} paint={body} />
      {handles}
    </>
  )
}
