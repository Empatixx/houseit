import type { HouseDocument } from '@houseit/core/document'
import { anchorInside } from '@houseit/geometry/anchor'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import { Html } from '@react-three/drei'
import { useDocument, usePlanDoc } from '../store/store'
import { toWorld } from './plan-coordinates'

const squareMetres = (area: number) => (area / 1_000_000).toFixed(1)

const LABEL_INSET = 1500

function labelAt(doc: HouseDocument, room: Room): Point {
  const outline = room.nodes.map((id) => doc.nodes[id]!)
  if (containsPoint(outline, room.centre.x, room.centre.y)) return room.centre
  const probes = outline.flatMap((a, index) => {
    const b = outline[(index + 1) % outline.length]!
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    if (span === 0) return []
    return [LABEL_INSET, LABEL_INSET / 2].map((inset) => ({
      x: (a.x + b.x) / 2 - ((b.y - a.y) / span) * inset,
      y: (a.y + b.y) / 2 + ((b.x - a.x) / span) * inset,
    }))
  })
  const inside = probes.filter((probe) => containsPoint(outline, probe.x, probe.y))
  if (inside.length === 0) return anchorInside(outline, room.area)
  return inside.reduce((best, next) =>
    clearance(outline, next) > clearance(outline, best) ? next : best,
  )
}

function clearance(outline: Point[], at: Point): number {
  return outline.reduce((least, a, index) => {
    const b = outline[(index + 1) % outline.length]!
    const along = { x: b.x - a.x, y: b.y - a.y }
    const length = along.x * along.x + along.y * along.y
    const t =
      length === 0
        ? 0
        : Math.max(0, Math.min(1, ((at.x - a.x) * along.x + (at.y - a.y) * along.y) / length))
    return Math.min(least, Math.hypot(at.x - (a.x + t * along.x), at.y - (a.y + t * along.y)))
  }, Infinity)
}

export function RoomAnnotations() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)

  return (
    <>
      {roomsOf(doc, level).map((room) => (
        <Html
          key={room.nodes.join('-')}
          position={toWorld(labelAt(doc, room).x, labelAt(doc, room).y)}
          center
          zIndexRange={[5, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="pointer-events-none select-none whitespace-nowrap text-center leading-tight">
            <div className="text-sm font-medium text-neutral-900">{room.name ?? 'unnamed'}</div>
            <div className="text-xs text-neutral-500">{squareMetres(room.clear)} m²</div>
          </div>
        </Html>
      ))}
    </>
  )
}
