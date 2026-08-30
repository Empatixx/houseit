import { floorMaterial } from '@houseit/core/floor-materials'
import { roomsOf } from '@houseit/geometry/rooms'
import { useMemo } from 'react'
import { Shape, ShapeGeometry } from 'three'
import { useDocument } from '../store/store'
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
          key: room.nodes.join('-'),
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
