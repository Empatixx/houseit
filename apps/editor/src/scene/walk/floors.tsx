import { floorMaterial } from '@houseit/core/floor-materials'
import { SLAB } from '@houseit/core/levels'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { holesIn, stairwaysOn, wellsInRoom } from '@houseit/geometry/wells'
import { useMemo } from 'react'
import { DoubleSide, ExtrudeGeometry, Path, Shape, ShapeGeometry } from 'three'
import { pick } from '../../edit/pick'
import { useSelection } from '../../store/selection'
import { usePlanDoc } from '../../store/store'
import { dragged } from '../drag'
import { floorTexture } from '../floor-texture'
import { MM } from '../plan-coordinates'

export function Floors({ level }: { level: string }) {
  const doc = usePlanDoc()
  const selected = useSelection((state) => state.selected)

  const floors = useMemo(
    () =>
      roomsOf(doc, level).map((room) => {
        const pierced = wellsInRoom(doc, level, room)
        const shape = shapeOf(
          room.nodes.map((id) => doc.nodes[id]!),
          pierced.map((well) => well.outline),
        )
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

const PLASTER = '#f4f3f0'
const EDGE = '#d9d6d0'

export function Ceilings({ level }: { level: string }) {
  const doc = usePlanDoc()
  const top = doc.levels[level]?.height ?? 0

  const slabs = useMemo(() => {
    const wells = stairwaysOn(doc, level)
    return roomsOf(doc, level).map((room) => {
      const outline = room.nodes.map((id) => doc.nodes[id]!)
      const holes = holesIn(
        outline,
        wells.map((well) => well.outline),
      )
      const shape = shapeOf(
        outline,
        holes.map((hole) => hole.outline),
      )
      return {
        key: `${room.nodes.join('-')}-${holes.map((hole) => wells[hole.index]!.object).join('-')}`,
        geometry: new ExtrudeGeometry(shape, { depth: SLAB * MM, bevelEnabled: false }),
      }
    })
  }, [doc, level])

  return (
    <>
      {slabs.map((slab) => (
        <mesh
          key={slab.key}
          geometry={slab.geometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, (top - SLAB) * MM, 0]}
        >
          <meshLambertMaterial attach="material-0" color={PLASTER} />
          <meshLambertMaterial attach="material-1" color={EDGE} />
        </mesh>
      ))}
    </>
  )
}

function shapeOf(outline: Point[], holes: Point[][]): Shape {
  const shape = new Shape()
  outline.forEach((corner, index) => {
    if (index === 0) shape.moveTo(corner.x * MM, corner.y * MM)
    else shape.lineTo(corner.x * MM, corner.y * MM)
  })
  shape.closePath()
  for (const outline of holes) {
    const hole = new Path()
    outline.forEach((corner, index) => {
      if (index === 0) hole.moveTo(corner.x * MM, corner.y * MM)
      else hole.lineTo(corner.x * MM, corner.y * MM)
    })
    hole.closePath()
    shape.holes.push(hole)
  }
  return shape
}
