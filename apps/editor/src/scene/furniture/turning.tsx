import type { Point } from '@houseit/geometry/outlines'
import { Html, Line } from '@react-three/drei'
import { RefreshCcwIcon } from 'lucide-react'
import { DoubleSide } from 'three'
import { EMPHASIS } from '../../store/hover'
import { MM, toWorld } from '../plan-coordinates'

const INK = EMPHASIS.picked.line
const FAINT = '#a1a1aa'
const TICKS = 24
const BAND = 0.09
const GLOW = 0.22

const spot = (centre: Point, angle: number, radius: number): Point => ({
  x: centre.x + Math.cos(angle) * radius,
  y: centre.y + Math.sin(angle) * radius,
})

const facing = (centre: Point, turn: number, radius: number): Point => ({
  x: centre.x - Math.sin(turn) * radius,
  y: centre.y + Math.cos(turn) * radius,
})

const short = (angle: number) => angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))

const run = (centre: Point, from: number, to: number, radius: number, height: number, steps = 40) =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const at = spot(centre, from + ((to - from) * index) / steps, radius)
    return toWorld(at.x, at.y, height)
  })

export function Turner({ at, height }: { at: Point; height: number }) {
  return (
    <Html
      position={toWorld(at.x, at.y, height)}
      center
      zIndexRange={[8, 5]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="pointer-events-none flex size-9 select-none items-center justify-center rounded-full border border-black/10 bg-white shadow-sm"
        style={{ color: INK }}
      >
        <RefreshCcwIcon size={22} strokeWidth={2.25} />
      </div>
    </Html>
  )
}

type DialProps = { centre: Point; height: number; base: number; turn: number; radius: number }

export function Dial({ centre, height, base, turn, radius }: DialProps) {
  const swept = short(turn - base)
  const degrees = Math.abs(Math.round((swept * 180) / Math.PI))
  const mark = (at: number, reach: number) => {
    const outer = facing(centre, at, radius)
    const inner = facing(centre, at, radius - reach)
    return [toWorld(outer.x, outer.y, height), toWorld(inner.x, inner.y, height)]
  }

  return (
    <>
      <Line points={run(centre, 0, Math.PI * 2, radius, height, 72)} color={FAINT} lineWidth={1} />
      {Array.from({ length: TICKS }, (_, index) => base + (index * Math.PI) / 12).map((at) => (
        <Line key={at} points={mark(at, radius * 0.09)} color={FAINT} lineWidth={1} />
      ))}
      {degrees === 0 ? null : (
        <mesh position={toWorld(centre.x, centre.y, height)} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[
              radius * (1 - BAND) * MM,
              radius * (1 + BAND) * MM,
              96,
              1,
              base + Math.PI / 2,
              swept,
            ]}
          />
          <meshBasicMaterial
            color={INK}
            side={DoubleSide}
            transparent
            opacity={GLOW}
            depthWrite={false}
          />
        </mesh>
      )}
      <Line points={mark(base, radius * 0.22)} color={INK} lineWidth={2.5} />
      <Line points={mark(turn, radius * 0.22)} color={INK} lineWidth={2.5} />
      <Html
        position={toWorld(centre.x, centre.y, height)}
        center
        zIndexRange={[8, 5]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="pointer-events-none select-none whitespace-nowrap rounded bg-white/90 px-1 text-[11px] font-medium leading-4"
          style={{ color: INK }}
        >
          {degrees}°
        </div>
      </Html>
    </>
  )
}
