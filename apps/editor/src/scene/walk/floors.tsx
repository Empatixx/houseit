import { floorMaterial } from '@houseit/core/floor-materials'
import { roomsOf } from '@houseit/geometry/rooms'
import { wellsInRoom } from '@houseit/geometry/wells'
import { useMemo } from 'react'
import { DoubleSide, Path, Shape, ShapeGeometry } from 'three'
import { pick } from '../../edit/pick'
import { useSelection } from '../../store/selection'
import { usePlanDoc } from '../../store/store'
import { dragged } from '../drag'
import { floorTexture } from '../floor-texture'
import { MM } from '../plan-coordinates'

/**
 * The floors, walked on: the same faces and the same photographs as in the
 * plan, lit rather than flat, and a click on one picks the room. Round the
 * house lies a pale ground, so a window looks out on something.
 */
export function Floors({ level }: { level: string }) {
  const doc = usePlanDoc()
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

        // The floor really is missing over a staircase, and it has to be missing
        // here too: a hole you can look down through and stairs coming up out of
        // it are the whole of how an upper storey says there is a way down.
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
          id: room.id,
          key: `${room.nodes.join('-')}-${room.floor ?? 'bare'}-${pierced.map((well) => well.object).join('-')}`,
          geometry: new ShapeGeometry(shape),
          texture: material ? floorTexture(material) : undefined,
        }
      }),
    [doc, level],
  )

  return (
    <>
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
            {/* Lit on both sides: a floor is the ceiling of the storey under it,
                and a ceiling you can see through is a house with no upstairs. */}
            {floor.texture ? (
              <meshLambertMaterial
                map={floor.texture}
                color={picked ? '#9db9ff' : '#ffffff'}
                side={DoubleSide}
              />
            ) : (
              <meshLambertMaterial color={picked ? '#9db9ff' : '#f7f7f5'} side={DoubleSide} />
            )}
          </mesh>
        )
      })}
    </>
  )
}
