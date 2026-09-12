import { levelBelow } from '@houseit/core/levels'
import { useMemo } from 'react'
import { useDocument, usePlanDoc } from '../store/store'
import { MM } from './plan-coordinates'

export function StoreyBelow() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)

  const walls = useMemo(() => {
    const under = levelBelow(doc, level)
    if (!under) return []
    return Object.values(doc.walls)
      .filter((wall) => wall.level === under.id)
      .flatMap((wall) => {
        const a = doc.nodes[wall.a]
        const b = doc.nodes[wall.b]
        if (!a || !b) return []
        return [
          {
            id: wall.id,
            middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            length: Math.hypot(b.x - a.x, b.y - a.y),
            thickness: wall.thickness,
            turn: Math.atan2(b.x - a.x, b.y - a.y),
          },
        ]
      })
  }, [doc, level])

  return (
    <>
      {walls.map((wall) => (
        <mesh
          key={wall.id}
          position={[wall.middle.x * MM, 0.004, -wall.middle.y * MM]}
          rotation={[0, wall.turn, 0]}
        >
          <boxGeometry args={[wall.thickness * MM, 0.001, wall.length * MM]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}
