import { floorMaterial } from '@houseit/core/floor-materials'
import { roomsOf } from '@houseit/geometry/rooms'
import { useMemo } from 'react'
import { Shape, ShapeGeometry } from 'three'
import { placeArmed } from '../edit/place-commands'
import { selectionStore } from '../store/selection'
import { useDocument } from '../store/store'
import { toolStore } from '../store/tool'
import { floorTexture } from './floor-texture'
import { MM } from './plan-coordinates'

/**
 * A filled floor under each derived room. Without it the plan is a set of
 * disconnected outlines; with it the rooms read as rooms. Rebuilt whenever the
 * document changes, which is also whenever the faces themselves change.
 *
 * A room with a material laid gets its texture; one without stays white, so an
 * unfinished plan still reads as a drawing rather than as a mistake.
 */
export function RoomFloors() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)

  const floors = useMemo(
    () =>
      roomsOf(doc, level).map((room) => {
        const shape = new Shape()
        room.nodes.forEach((id, index) => {
          const node = doc.nodes[id]!
          // Shapes are built in the XY plane and laid flat by the mesh rotation.
          if (index === 0) shape.moveTo(node.x * MM, node.y * MM)
          else shape.lineTo(node.x * MM, node.y * MM)
        })
        shape.closePath()
        const material = room.floor ? floorMaterial(room.floor) : undefined
        return {
          room,
          // The material is part of the key on purpose. Laying a floor in a room
          // that had none swaps a plain white material for one with a texture, and
          // patching that onto the material already on screen leaves it black
          // until the page is reloaded. Keyed this way the mesh is built afresh,
          // with its texture from the start, exactly as it is on a reload.
          key: `${room.nodes.join('-')}-${room.floor ?? 'bare'}`,
          id: room.id,
          geometry: new ShapeGeometry(shape),
          texture: material ? floorTexture(material) : undefined,
        }
      }),
    [doc, level],
  )

  return (
    <>
      {floors.map((floor) => (
        <mesh
          key={floor.key}
          geometry={floor.geometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          receiveShadow
          // A click, not the end of a pan: the pointer has to have stayed put.
          onClick={(event) => {
            if (event.delta > 4) return
            event.stopPropagation()
            // Something armed from the palette lands where the room was clicked;
            // otherwise the click picks the room.
            const armed = toolStore.getState().armed
            if (armed) {
              const point = { x: event.point.x / MM, y: -event.point.z / MM }
              if (placeArmed(armed, floor.room, point) && !event.shiftKey) {
                toolStore.getState().arm(null)
              }
              return
            }
            selectionStore.getState().select(floor.id ? { kind: 'room', id: floor.id } : null)
          }}
        >
          {floor.texture ? (
            <meshBasicMaterial map={floor.texture} />
          ) : (
            <meshBasicMaterial color="#ffffff" />
          )}
        </mesh>
      ))}
    </>
  )
}
