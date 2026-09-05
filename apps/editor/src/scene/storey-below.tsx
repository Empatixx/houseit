import { levelBelow } from '@houseit/core/levels'
import { useMemo } from 'react'
import { useDocument, usePlanDoc } from '../store/store'
import { MM } from './plan-coordinates'

/**
 * The storey underneath, drawn faintly under the one being worked on.
 *
 * A first floor is drawn on top of the ground floor, not beside it: the walls
 * carrying it stand where the walls below stand, and the stairs come up where
 * they went down. Without the storey below there to line up against, drawing an
 * upper floor is guesswork with a tape measure — you can only put the wall
 * where you think it goes, and find out later.
 *
 * Only walls, and only their lines. What is wanted is where the house is, not
 * what it was furnished with; anything more and the storey you are actually
 * drawing is the fainter of the two.
 */
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
          // Under the floors of the storey being drawn, so laying a floor covers
          // it: what is underneath should show through where nothing is yet.
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
