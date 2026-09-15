import { roomLabel } from '@houseit/geometry/room-label'
import { roomsOf } from '@houseit/geometry/rooms'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useDocument, usePlanDoc } from '../store/store'
import { MM, toWorld } from './plan-coordinates'

export function RoomAnnotations() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  return (
    <>
      {roomsOf(doc, level).map((room) => (
        <Annotation
          key={room.nodes.join('-')}
          label={roomLabel(doc, level, room)}
          name={room.name ?? 'unnamed'}
          area={room.clear}
        />
      ))}
    </>
  )
}
function Annotation({
  label,
  name,
  area,
}: {
  label: ReturnType<typeof roomLabel>
  name: string
  area: number
}) {
  const element = useRef<HTMLDivElement>(null)
  const full = useRef<HTMLDivElement>(null)
  const short = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  useFrame(({ camera }) => {
    if (!element.current) return
    const width = Math.max(20, Math.min(220, label.width * MM * camera.zoom * 0.85))
    const height = label.height * MM * camera.zoom * 0.85
    element.current.style.width = `${width}px`
    element.current.style.fontSize = `${Math.max(8, Math.min(14, width / 8, height / 3))}px`
    const compact = width < 55 || height < 32
    if (full.current) full.current.style.display = compact ? 'none' : 'block'
    if (short.current) short.current.style.display = compact ? 'block' : 'none'
    if (measure.current) measure.current.style.display = height < 20 ? 'none' : 'block'
  })
  return (
    <Html
      position={toWorld(label.x, label.y)}
      center
      zIndexRange={[5, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={element}
        className="pointer-events-none select-none text-center leading-tight"
        style={{ overflowWrap: 'anywhere' }}
      >
        <div ref={full} className="font-medium text-neutral-900">
          {name}
        </div>
        <div ref={short} className="font-medium text-neutral-900" style={{ display: 'none' }}>
          {/^\d{3}\b/.exec(name)?.[0] ?? name}
        </div>
        <div ref={measure} className="text-neutral-500">
          {(area / 1e6).toFixed(1)} m²
        </div>
      </div>
    </Html>
  )
}
