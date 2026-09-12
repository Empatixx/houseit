import type { HouseDocument, Wall } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { besideWall, type Dressed, paintFor } from '@houseit/scene/dressing'
import { useMemo } from 'react'
import { pick } from '../edit/pick'
import { dragged } from '../scene/drag'
import { toWorld } from '../scene/plan-coordinates'
import { materialOf } from '../scene/three/materials'
import { useSelection } from '../store/selection'
import { useWallGeometry } from './use-wall-geometry'
import { wallBody } from './wall-body'

export function EngineWalls({
  doc,
  level,
  picking,
}: {
  doc: HouseDocument
  level: string
  picking: boolean
}) {
  const dressed = useMemo(
    () =>
      roomsOf(doc, level).map((room) => ({
        outline: room.nodes.map((id) => doc.nodes[id]!),
        worn: room.id ? doc.rooms[room.id] : undefined,
      })),
    [doc, level],
  )
  return Object.values(doc.walls)
    .filter((wall) => wall.level === level)
    .map((wall) => (
      <EngineWall key={wall.id} doc={doc} wall={wall} dressed={dressed} picking={picking} />
    ))
}

function EngineWall({
  doc,
  wall,
  dressed,
  picking,
}: {
  doc: HouseDocument
  wall: Wall
  dressed: Dressed[]
  picking: boolean
}) {
  const body = useMemo(() => wallBody(doc, wall), [doc, wall])
  const geometry = useWallGeometry(body)
  const selected = useSelection((s) => s.selected?.kind === 'wall' && s.selected.id === wall.id)
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const worn = besideWall(dressed, a, b, wall.thickness)
  const materials = worn.map((side) =>
    materialOf(
      paintFor(picking && selected ? '#a4baff' : side?.walls, '#f1f0ed', {
        width: body.length,
        height: body.height,
      }),
    ),
  )
  if (!geometry) return null
  return (
    <mesh
      userData={{ houseit: { kind: 'wall', id: wall.id } }}
      geometry={geometry}
      material={materials}
      position={toWorld(a.x, a.y, wall.baseOffset)}
      rotation={[0, Math.atan2(b.y - a.y, b.x - a.x), 0]}
      castShadow
      receiveShadow
      onClick={
        picking
          ? (event) => {
              if (dragged(event)) return
              event.stopPropagation()
              pick({ kind: 'wall', id: wall.id })
            }
          : undefined
      }
    />
  )
}
