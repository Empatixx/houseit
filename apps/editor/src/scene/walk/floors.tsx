import { floorMaterial } from '@houseit/core/floor-materials'
import { roomsOf } from '@houseit/geometry/rooms'
import { useMemo } from 'react'
import { Shape, ShapeGeometry } from 'three'
import { pick } from '../../edit/pick'
import { useSelection } from '../../store/selection'
import { useDocument, usePlanDoc } from '../../store/store'
import { dragged } from '../drag'
import { floorTexture } from '../floor-texture'
import { MM } from '../plan-coordinates'

/**
 * The floors, walked on: the same faces and the same photographs as in the
 * plan, lit rather than flat, and a click on one picks the room. Round the
 * house lies a pale ground, so a window looks out on something.
 */
export function Floors() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  const selected = useSelection((state) => state.selected)

  const floors = useMemo(
    () =>
      roomsOf(doc, level).map((room) => {
        const shape = new Shape()
        room.nodes.forEach((id, index) => {
          const node = doc.nodes[id]!
          if (index === 0) shape.moveTo(node.x * MM, node.y * MM)
          else shape.lineTo(node.x * MM, node.y * MM)
        })
        shape.closePath()
        const material = room.floor ? floorMaterial(room.floor) : undefined
        return {
          id: room.id,
          key: `${room.nodes.join('-')}-${room.floor ?? 'bare'}`,
          geometry: new ShapeGeometry(shape),
          texture: material ? floorTexture(material) : undefined,
        }
      }),
    [doc, level],
  )

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#dfe3e8" />
      </mesh>
      {floors.map((floor) => {
        const picked =
          floor.id !== undefined && selected?.kind === 'room' && selected.id === floor.id
        return (
          <mesh
            key={floor.key}
            geometry={floor.geometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.002, 0]}
            onClick={(event) => {
              if (dragged(event)) return
              event.stopPropagation()
              pick(floor.id ? { kind: 'room', id: floor.id } : null)
            }}
          >
            {floor.texture ? (
              <meshLambertMaterial map={floor.texture} color={picked ? '#9db9ff' : '#ffffff'} />
            ) : (
              <meshLambertMaterial color={picked ? '#9db9ff' : '#f7f7f5'} />
            )}
          </mesh>
        )
      })}
    </>
  )
}
