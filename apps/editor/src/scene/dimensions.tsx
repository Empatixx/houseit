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
import { useEffect, useMemo } from 'react'
import { Shape, ShapeGeometry, Vector3 } from 'three'
import { useNativeTools } from '../engine/native-tools'
import { useSelection } from '../store/selection'
import { useDocument, usePlanDoc } from '../store/store'
import { MM, toWorld } from './plan-coordinates'

const INK = '#714cb6'
export const ABOVE = 3200

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
  const tools = useNativeTools()
  const { from, to } = dimension
  useEffect(() => {
    if (!tools) return
    return tools.dimension(
      new Vector3(...toWorld(from.x, from.y, ABOVE)),
      new Vector3(...toWorld(to.x, to.y, ABOVE)),
    )
  }, [tools, from.x, from.y, to.x, to.y])
  return null
}

const keyOf = ({ from, to }: Dimension) => `${from.x},${from.y}-${to.x},${to.y}`

export const metres = (length: number) => `${(length / 1000).toFixed(2)} m`
