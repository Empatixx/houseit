import { floorMaterial } from '@houseit/core/floor-materials'
import { openingRecesses } from '@houseit/geometry/opening-recesses'
import { roomsOf } from '@houseit/geometry/rooms'
import { wellsInRoom } from '@houseit/geometry/wells'
import { useEffect, useMemo } from 'react'
import { Matrix4, MeshBasicMaterial, Path, Shape, ShapeGeometry } from 'three'
import { aimAt, finishDrawing, putDown } from '../edit/draw-commands'
import { pick } from '../edit/pick'
import { placeArmed } from '../edit/place-commands'
import { wallUnder } from '../edit/wall-under'
import { NativeSurface } from '../engine/fragment-display-layer'
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
    const recesses = openingRecesses(doc, level)
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
      const shapes = [
        shape,
        ...recesses
          .filter((r) => r.extension.length && room.walls.includes(r.wall))
          .map((r) => {
            const extension = new Shape()
            r.extension.forEach((p, i) => {
              if (i === 0) extension.moveTo(p.x * MM, p.y * MM)
              else extension.lineTo(p.x * MM, p.y * MM)
            })
            extension.closePath()
            return extension
          }),
      ]
      return {
        room,
        key: room.id ?? room.nodes.join('-'),
        id: room.id,
        geometry: new ShapeGeometry(shapes),
        material: new MeshBasicMaterial({
          color: '#ffffff',
          map: material ? floorTexture(material) : null,
        }),
      }
    })
  }, [doc, level])

  useEffect(
    () => () => {
      for (const floor of floors) {
        floor.geometry.dispose()
        floor.material.dispose()
      }
    },
    [floors],
  )

  return (
    <>
      {floors.map((floor) => (
        <NativeSurface
          key={floor.key}
          surface={{
            id: `floor:${level}:${floor.key}`,
            owner: floor.id ? { kind: 'room', id: floor.id } : undefined,
            category: 'IFCCOVERING',
            geometry: floor.geometry,
            materials: [floor.material],
            transform: new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.01, 0),
            mapping: { kind: 'flat' },
            casts: false,
          }}
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
        />
      ))}
      {floors.map((floor) =>
        floor.id && hovered?.kind === 'room' && hovered.id === floor.id ? (
          <mesh
            key={`${floor.key}-hover`}
            userData={{ houseitHelper: true }}
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
