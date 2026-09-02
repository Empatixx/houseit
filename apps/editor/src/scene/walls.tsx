import { boundaryWallsOf } from '@houseit/geometry/boundary'
import { roomsOf } from '@houseit/geometry/rooms'
import { useMemo } from 'react'
import { useSelection } from '../store/selection'
import { useDocument } from '../store/store'
import { WallMesh } from './wall-mesh'

export function Walls() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const selected = useSelection((state) => state.selected)

  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)

  const degrees = new Map<string, number>()
  for (const wall of walls) {
    for (const node of [wall.a, wall.b]) {
      degrees.set(node, (degrees.get(node) ?? 0) + 1)
    }
  }

  // A picked room shows as its walls going blue, so they are told which they are.
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
          ofPickedRoom={roomWalls.has(wall.id)}
        />
      ))}
    </>
  )
}
