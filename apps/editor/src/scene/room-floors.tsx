import type { HouseDocument } from '@houseit/core/document'
import { floorMaterial } from '@houseit/core/floor-materials'
import { openingRecesses } from '@houseit/geometry/opening-recesses'
import { roomsOf } from '@houseit/geometry/rooms'
import { wellsInRoom } from '@houseit/geometry/wells'
import { useEffect, useMemo } from 'react'
import { Matrix4, MeshBasicMaterial } from 'three'
import { aimAt, finishDrawing, putDown } from '../edit/draw-commands'
import { pick } from '../edit/pick'
import { placeArmed } from '../edit/place-commands'
import { wallUnder } from '../edit/wall-under'
import { NativeSurface } from '../engine/fragment-display-layer'
import { useNativeGeometry } from '../engine/use-wall-geometry'
import { hoverStore, useHover } from '../store/hover'
import { useDocument, usePlanDoc } from '../store/store'
import { toolStore } from '../store/tool'
import { floorTexture } from './floor-texture'
import { usePlain } from './plain'
import { MM } from './plan-coordinates'

export function RoomFloors() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  const floors = useMemo(() => roomsOf(doc, level), [doc, level])
  const recesses = useMemo(() => openingRecesses(doc, level), [doc, level])
  return floors.map((room) => (
    <RoomFloor
      key={room.id ?? room.nodes.join('-')}
      room={room}
      doc={doc}
      level={level}
      recesses={recesses}
    />
  ))
}

function RoomFloor({
  room,
  doc,
  level,
  recesses,
}: {
  room: ReturnType<typeof roomsOf>[number]
  doc: HouseDocument
  level: string
  recesses: ReturnType<typeof openingRecesses>
}) {
  const plainly = usePlain()
  const noticed = useHover((state) => state.hovered)
  const hovered = plainly ? null : noticed
  const profiles = useMemo(() => {
    const corner = (point: { x: number; y: number }) => ({ x: point.x, z: -point.y })
    return [
      {
        outline: room.nodes.map((id) => corner(doc.nodes[id]!)),
        holes: wellsInRoom(doc, level, room).map((well) => well.outline.map(corner)),
      },
      ...recesses
        .filter((r) => r.extension.length && room.walls.includes(r.wall))
        .map((r) => ({ outline: r.extension.map(corner), holes: [] })),
    ]
  }, [doc, level, room, recesses])
  const { geometry, key } = useNativeGeometry({ kind: 'sheets', profiles })
  const material = useMemo(() => {
    const finish = room.floor ? floorMaterial(room.floor) : undefined
    return new MeshBasicMaterial({ color: '#ffffff', map: finish ? floorTexture(finish) : null })
  }, [room.floor])
  useEffect(() => () => material.dispose(), [material])
  if (!geometry) return null
  return (
    <>
      <NativeSurface
        surface={{
          id: `floor:${level}:${room.id ?? room.nodes.join('-')}`,
          owner: room.id ? { kind: 'room', id: room.id } : undefined,
          category: 'IFCCOVERING',
          geometry,
          geometryKey: key,
          materials: [material],
          transform: new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.01, 0),
          mapping: { kind: 'flat' },
          casts: false,
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          hoverStore.getState().hover(room.id ? { kind: 'room', id: room.id } : null)
        }}
        onPointerMove={(event) => {
          if (toolStore.getState().armed?.kind === 'wall') {
            aimAt({ x: event.point.x / MM, y: -event.point.z / MM })
          }
        }}
        onPointerOut={() => hoverStore.getState().hover(null)}
        onDoubleClick={() => {
          if (toolStore.getState().armed?.kind === 'wall') finishDrawing()
        }}
        onClick={(event) => {
          if (event.delta > 4) return
          event.stopPropagation()
          const armed = toolStore.getState().armed
          if (armed) {
            const point = { x: event.point.x / MM, y: -event.point.z / MM }
            if (armed.kind === 'wall') {
              putDown(point)
              return
            }
            if (placeArmed(armed, room, point) && !event.shiftKey) {
              toolStore.getState().arm(null)
            }
            return
          }
          if (!room.id) {
            pick(null)
            return
          }
          const here = { x: event.point.x / MM, y: -event.point.z / MM }
          const edge = wallUnder(doc, level, room, here)
          pick(edge ? { kind: 'wall', id: edge } : { kind: 'room', id: room.id })
        }}
      />
      {room.id && hovered?.kind === 'room' && hovered.id === room.id ? (
        <mesh
          userData={{ houseitHelper: true }}
          geometry={geometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.015, 0]}
        >
          <meshBasicMaterial color="#714cb6" transparent opacity={0.08} depthWrite={false} />
        </mesh>
      ) : null}
    </>
  )
}
