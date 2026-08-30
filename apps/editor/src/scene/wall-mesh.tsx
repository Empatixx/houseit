import type { HouseDocument, Wall } from '@houseit/core/document'
import { MM, toWorld } from './plan-coordinates'
import { planPieces } from './wall-pieces'

type WallMeshProps = {
  wall: Wall
  doc: HouseDocument
  /** How many walls meet at each node, so free ends are not extended. */
  degrees: Map<string, number>
}

/**
 * One wall, drawn as a stack of boxes.
 *
 * Walls stop at the node they share, which leaves an empty square in every
 * corner. Each end that meets another wall is therefore extended by half the
 * thickness to fill it. Free ends are left alone — extending those would show as
 * a stub poking out of the plan.
 *
 * What the boxes are is `wall-pieces`. Which layer covers which is decided by
 * lifting one above another, because the plan is drawn from straight overhead:
 * there is no z-order to set, only height.
 */
export function WallMesh({ wall, doc, degrees }: WallMeshProps) {
  const a = doc.nodes[wall.a]
  const b = doc.nodes[wall.b]
  if (!a || !b) return null

  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy)
  if (span === 0) return null

  const growA = (degrees.get(wall.a) ?? 0) > 1 ? wall.thickness / 2 : 0
  const growB = (degrees.get(wall.b) ?? 0) > 1 ? wall.thickness / 2 : 0
  const length = span + growA + growB

  const openings = Object.values(doc.openings).filter((opening) => opening.wall === wall.id)
  const pieces = planPieces(wall, openings, length, growA, span)
  const angle = Math.atan2(dy, dx)

  return (
    <>
      {pieces.map((piece) => {
        const travelled = piece.at - growA
        const aside = piece.aside ?? 0
        const x = a.x + (travelled * dx - aside * dy) / span
        const y = a.y + (travelled * dy + aside * dx) / span
        const base = wall.baseOffset + piece.base

        return (
          <mesh
            key={piece.key}
            position={toWorld(x, y, base + piece.height / 2)}
            rotation={[0, angle + (piece.turn ?? 0), 0]}
          >
            <boxGeometry args={[piece.length * MM, piece.height * MM, piece.thickness * MM]} />
            <meshBasicMaterial color={piece.colour} />
          </mesh>
        )
      })}
    </>
  )
}
