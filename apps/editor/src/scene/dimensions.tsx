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
import { useDocument } from '../store/store'
import { MM, toWorld } from './plan-coordinates'

/** The blue the reference picks things out in, and the sheet the labels sit on. */
const INK = '#2f6fed'
/** Drawn above everything: walls stand 2.8 m tall, and a dimension is read over them. */
const ABOVE = 3200

/** The little bar across each end of a dimension line, in millimetres. */
const TICK = 110

/**
 * Dimensions, the way the reference shows them: pick a room and every wall of it gets
 * its clear length, with the whole plan's width and depth outside; pick a thing
 * and it gets its distances to the walls round it. Or ask for all of them.
 * What is picked is shown by its colour, where it is drawn; this only measures.
 *
 * The numbers come from `@houseit/geometry`, so what is drawn here is what the
 * agent will be told when it asks — one source for both.
 */
export function Dimensions() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const selected = useSelection((state) => state.selected)
  const showAll = useSelection((state) => state.showAll)

  const rooms = useMemo(() => roomsOf(doc, level), [doc, level])
  const extent = useMemo(() => planExtent(doc, level), [doc, level])

  const pickedRoom =
    selected?.kind === 'room' ? rooms.find((room) => room.id === selected.id) : undefined
  const pickedObject = selected?.kind === 'object' ? doc.objects[selected.id] : undefined
  const objectRoom = pickedObject ? rooms.find((room) => room.id === pickedObject.room) : undefined
  const spot =
    pickedObject && objectRoom ? standingAt(doc, level, objectRoom, pickedObject) : undefined

  const lines: Dimension[] = []
  if (showAll) {
    for (const room of rooms) lines.push(...roomDimensions(doc, level, room))
  } else if (pickedRoom) {
    lines.push(...roomDimensions(doc, level, pickedRoom))
  }
  if ((showAll || pickedRoom) && extent) lines.push(...extentDimensions(extent))
  if (pickedObject && objectRoom && spot) {
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

/** The picked room, washed blue under whatever stands in it. */
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

/** A dimension: the line, a bar across each end, and the length beside its middle. */
function DimensionLine({ dimension }: { dimension: Dimension }) {
  const { from, to, offset } = dimension
  const span = Math.hypot(to.x - from.x, to.y - from.y) || 1
  const along = { x: (to.x - from.x) / span, y: (to.y - from.y) / span }
  const bar = { x: -along.y * TICK, y: along.x * TICK }
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  // The label stands off the line on the side the offset says, in pixels, so it
  // keeps its distance whatever the zoom.
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
        zIndexRange={[20, 10]}
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

/** A dimension is told from another by where it runs. */
const keyOf = ({ from, to }: Dimension) => `${from.x},${from.y}-${to.x},${to.y}`

/** Millimetres as metres to the centimetre: 4.20 m, the way a plan is read here. */
const metres = (length: number) => `${(length / 1000).toFixed(2)} m`
