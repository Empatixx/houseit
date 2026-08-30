import { useDocument } from '../store/store'
import { WallMesh } from './wall-mesh'

export function Walls() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)

  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)

  const degrees = new Map<string, number>()
  for (const wall of walls) {
    for (const node of [wall.a, wall.b]) {
      degrees.set(node, (degrees.get(node) ?? 0) + 1)
    }
  }

  return (
    <>
      {walls.map((wall) => (
        <WallMesh key={wall.id} wall={wall} doc={doc} degrees={degrees} />
      ))}
    </>
  )
}
