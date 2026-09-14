import { boundaryWallsOf } from '@houseit/geometry/boundary'
import { enclosureOf, enclosuresOf } from '@houseit/geometry/enclosure'
import { roomsOf } from '@houseit/geometry/rooms'
import { useMemo } from 'react'
import { useSelection } from '../store/selection'
import { useDocument, usePlanDoc } from '../store/store'
import { usePlain } from './plain'
import { WallMesh } from './wall-mesh'

export function Walls() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  const plainly = usePlain()
  const chosen = useSelection((state) => state.selected)
  const selected = plainly ? null : chosen

  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)

  const degrees = new Map<string, number>()
  for (const wall of walls) {
    for (const node of [wall.a, wall.b]) {
      degrees.set(node, (degrees.get(node) ?? 0) + 1)
    }
  }

  const enclosures = useMemo(() => enclosuresOf(doc, level), [doc, level])

  const roomWalls = useMemo(() => {
    if (selected?.kind !== 'room') return new Set<string>()
    const room = roomsOf(doc, level).find((candidate) => candidate.id === selected.id)
    return new Set(room ? boundaryWallsOf(doc, level, room).map((wall) => wall.id) : [])
  }, [doc, level, selected])

  return (
    <>
      {walls.map((wall) => (
        <WallMesh
          key={wall.id}
          wall={wall}
          doc={doc}
          degrees={degrees}
          enclosure={enclosureOf(enclosures, wall.id)}
          ofPickedRoom={roomWalls.has(wall.id)}
          pickedRoom={selected?.kind === 'room' ? selected.id : undefined}
        />
      ))}
    </>
  )
}
