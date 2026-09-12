import type { HouseDocument } from '@houseit/core/document'
import {
  type Dimension,
  extentDimensions,
  objectClearances,
  planExtent,
  roomDimensions,
} from '@houseit/geometry/dimensions'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { standingAt } from '@houseit/geometry/standing'
import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Shape, ShapeGeometry } from 'three'
import { useSelection } from '../store/selection'
import { useDocument, usePlanDoc } from '../store/store'
import { MM, toWorld } from './plan-coordinates'

const INK = '#714cb6'
export const ABOVE = 3200

const TICK = 110

export function Dimensions() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  const selected = useSelection((state) => state.selected)
  const measured = useSelection((state) => state.measured)

  const rooms = useMemo(() => roomsOf(doc, level), [doc, level])
  const extent = useMemo(() => planExtent(doc, level), [doc, level])

  const pickedRoom =
    selected?.kind === 'room' ? rooms.find((room) => room.id === selected.id) : undefined
  const pickedObject = selected?.kind === 'object' ? doc.objects[selected.id] : undefined
  const objectRoom = pickedObject ? rooms.find((room) => room.id === pickedObject.room) : undefined
  const spot =
    pickedObject && objectRoom ? standingAt(doc, level, objectRoom, pickedObject) : undefined

  const measuring =
    measured === 'all' ? rooms : measured === 'selected' && pickedRoom ? [pickedRoom] : []

  const lines: Dimension[] = measuring.flatMap((room) => roomDimensions(doc, level, room))
  if (measuring.length > 0 && extent) lines.push(...extentDimensions(extent))
  if (measured !== 'none' && pickedObject && objectRoom && spot) {
    lines.push(...objectClearances(doc, level, objectRoom, spot, pickedObject))
  }

  return (
    <>
      {pickedRoom ? <RoomHighlight room={pickedRoom} doc={doc} /> : null}
      {lines.map((line) => (
        <DimensionLine key={keyOf(line)} dimension={line} />
      ))}
    </>
  )
}

function RoomHighlight({ room, doc }: { room: Room; doc: HouseDocument }) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    room.nodes.forEach((id, index) => {
      const node = doc.nodes[id]!
      if (index === 0) shape.moveTo(node.x * MM, node.y * MM)
      else shape.lineTo(node.x * MM, node.y * MM)
    })
    shape.closePath()
    return new ShapeGeometry(shape)
  }, [room, doc])

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <meshBasicMaterial color={INK} transparent opacity={0.18} depthWrite={false} />
    </mesh>
  )
}

export function DimensionLine({ dimension }: { dimension: Dimension }) {
  const { from, to, offset } = dimension
  const span = Math.hypot(to.x - from.x, to.y - from.y) || 1
  const along = { x: (to.x - from.x) / span, y: (to.y - from.y) / span }
  const bar = { x: -along.y * TICK, y: along.x * TICK }
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const shift = { x: offset.x * 12, y: -offset.y * 12 }

  return (
    <>
      <Line
        points={[toWorld(from.x, from.y, ABOVE), toWorld(to.x, to.y, ABOVE)]}
        color={INK}
        lineWidth={1}
      />
      {[from, to].map((end, index) => (
        <Line
          key={index === 0 ? 'from' : 'to'}
          points={[
            toWorld(end.x - bar.x, end.y - bar.y, ABOVE),
            toWorld(end.x + bar.x, end.y + bar.y, ABOVE),
          ]}
          color={INK}
          lineWidth={1}
        />
      ))}
      <Html
        position={toWorld(middle.x, middle.y, ABOVE)}
        center
        zIndexRange={[8, 5]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="pointer-events-none select-none whitespace-nowrap rounded bg-white/90 px-1 text-[11px] font-medium leading-4"
          style={{ color: INK, transform: `translate(${shift.x}px, ${shift.y}px)` }}
        >
          {metres(dimension.length)}
        </div>
      </Html>
    </>
  )
}

const keyOf = ({ from, to }: Dimension) => `${from.x},${from.y}-${to.x},${to.y}`

export const metres = (length: number) => `${(length / 1000).toFixed(2)} m`
