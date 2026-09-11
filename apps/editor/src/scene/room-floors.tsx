import { floorMaterial } from '@houseit/core/floor-materials'
import { roomsOf } from '@houseit/geometry/rooms'
import { wellsInRoom } from '@houseit/geometry/wells'
import { useMemo } from 'react'
import { Path, Shape, ShapeGeometry } from 'three'
import { aimAt, finishDrawing, putDown } from '../edit/draw-commands'
import { pick } from '../edit/pick'
import { placeArmed } from '../edit/place-commands'
import { wallUnder } from '../edit/wall-under'
import { hoverStore, useHover } from '../store/hover'
import { useDocument, usePlanDoc } from '../store/store'
import { toolStore } from '../store/tool'
import { floorTexture } from './floor-texture'
import { usePlain } from './plain'
import { MM } from './plan-coordinates'

export function RoomFloors() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  const plainly = usePlain()
  const noticed = useHover((state) => state.hovered)
  const hovered = plainly ? null : noticed

  const floors = useMemo(() => {
    return roomsOf(doc, level).map((room) => {
      const shape = new Shape()
      room.nodes.forEach((id, index) => {
        const node = doc.nodes[id]!
        if (index === 0) shape.moveTo(node.x * MM, node.y * MM)
        else shape.lineTo(node.x * MM, node.y * MM)
      })
      shape.closePath()

      const pierced = wellsInRoom(doc, level, room)
      for (const well of pierced) {
        const hole = new Path()
        well.outline.forEach((corner, index) => {
          if (index === 0) hole.moveTo(corner.x * MM, corner.y * MM)
          else hole.lineTo(corner.x * MM, corner.y * MM)
        })
        hole.closePath()
        shape.holes.push(hole)
      }

      const material = room.floor ? floorMaterial(room.floor) : undefined
      return {
        room,
        key: `${room.nodes.join('-')}-${room.floor ?? 'bare'}-${pierced.map((it) => it.object).join('-')}`,
        id: room.id,
        geometry: new ShapeGeometry(shape),
        texture: material ? floorTexture(material) : undefined,
      }
    })
  }, [doc, level])

  return (
    <>
      {floors.map((floor) => (
        <mesh
          key={floor.key}
          geometry={floor.geometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          receiveShadow
          onPointerOver={(event) => {
            event.stopPropagation()
            hoverStore.getState().hover(floor.id ? { kind: 'room', id: floor.id } : null)
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
              if (placeArmed(armed, floor.room, point) && !event.shiftKey) {
                toolStore.getState().arm(null)
              }
              return
            }
            if (!floor.id) {
              pick(null)
              return
            }
            const here = { x: event.point.x / MM, y: -event.point.z / MM }
            const edge = wallUnder(doc, level, floor.room, here)
            pick(edge ? { kind: 'wall', id: edge } : { kind: 'room', id: floor.id })
          }}
        >
          {floor.texture ? (
            <meshBasicMaterial map={floor.texture} />
          ) : (
            <meshBasicMaterial color="#ffffff" />
          )}
        </mesh>
      ))}
      {floors.map((floor) =>
        floor.id && hovered?.kind === 'room' && hovered.id === floor.id ? (
          <mesh
            key={`${floor.key}-hover`}
            geometry={floor.geometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.015, 0]}
          >
            <meshBasicMaterial color="#714cb6" transparent opacity={0.08} depthWrite={false} />
          </mesh>
        ) : null,
      )}
    </>
  )
}
