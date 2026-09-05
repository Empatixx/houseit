import type { HouseDocument, Opening, Wall } from '@houseit/core/document'
import { pick } from '../../edit/pick'
import { EMPHASIS } from '../../store/hover'
import { useSelection } from '../../store/selection'
import { usePlanDoc } from '../../store/store'
import { dragged } from '../drag'
import { MM, toWorld } from '../plan-coordinates'
import { planPieces, solidPieces, type WallPiece } from '../wall-pieces'

/** What the walls, the leaves and the glass are painted. */
const PAINT = {
  wall: '#f1f0ed',
  leaf: '#cdb894',
  garage: '#f5f5f4',
  glass: '#a7c8e6',
} as const

/** The plan pieces that stand in an opening: a leaf, a sliding panel, a garage door. */
const STANDS_IN_OPENING = /-(leaf|near|far|panel)$/

/**
 * The walls, at their real height, with the openings as holes: a sill under
 * every window and a head over every opening, the glass in the window, and
 * the door standing open the way the plan draws it. A click picks the wall,
 * or the door or window clicked.
 */
export function Walls({ level }: { level: string }) {
  const doc = usePlanDoc()
  const selected = useSelection((state) => state.selected)

  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)
  const degrees = new Map<string, number>()
  for (const wall of walls) {
    for (const node of [wall.a, wall.b]) degrees.set(node, (degrees.get(node) ?? 0) + 1)
  }

  return (
    <>
      {walls.map((wall) => (
        <StandingWall
          key={wall.id}
          wall={wall}
          doc={doc}
          degrees={degrees}
          picked={selected?.kind === 'wall' && selected.id === wall.id}
          pickedOpening={selected?.kind === 'opening' ? selected.id : undefined}
        />
      ))}
    </>
  )
}

type StandingWallProps = {
  wall: Wall
  doc: HouseDocument
  degrees: Map<string, number>
  picked: boolean
  pickedOpening: string | undefined
}

function StandingWall({ wall, doc, degrees, picked, pickedOpening }: StandingWallProps) {
  const a = doc.nodes[wall.a]
  const b = doc.nodes[wall.b]
  if (!a || !b) return null
  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy)
  if (span === 0) return null
  // Extended by half a thickness into every corner it shares, as in the plan.
  const growA = (degrees.get(wall.a) ?? 0) > 1 ? wall.thickness / 2 : 0
  const growB = (degrees.get(wall.b) ?? 0) > 1 ? wall.thickness / 2 : 0
  const length = span + growA + growB
  const angle = Math.atan2(dy, dx)

  const openings = Object.values(doc.openings).filter((opening) => opening.wall === wall.id)
  const solids = solidPieces(wall, openings, length, growA, span)
  const standing = planPieces(wall, openings, length, growA, span).filter((piece) =>
    STANDS_IN_OPENING.test(piece.key),
  )

  /** Where a piece's middle is on the plan, from how far along and how far aside it is. */
  const place = (piece: Pick<WallPiece, 'at' | 'aside'>) => {
    const travelled = piece.at - growA
    const aside = piece.aside ?? 0
    return {
      x: a.x + (travelled * dx - aside * dy) / span,
      y: a.y + (travelled * dy + aside * dx) / span,
    }
  }

  const picker =
    (opening: Opening | undefined) => (event: { delta: number; stopPropagation: () => void }) => {
      if (dragged(event)) return
      event.stopPropagation()
      pick(opening ? { kind: 'opening', id: opening.id } : { kind: 'wall', id: wall.id })
    }

  return (
    <>
      {solids.map((piece) => {
        const at = place(piece)
        return (
          <mesh
            key={piece.key}
            position={toWorld(at.x, at.y, wall.baseOffset + piece.base + piece.height / 2)}
            rotation={[0, angle, 0]}
            onClick={picker(undefined)}
          >
            <boxGeometry args={[piece.length * MM, piece.height * MM, piece.thickness * MM]} />
            <meshLambertMaterial color={picked ? EMPHASIS.picked.fill : PAINT.wall} />
          </mesh>
        )
      })}
      {standing.map((piece) => {
        const opening = piece.opening ? doc.openings[piece.opening] : undefined
        if (!opening) return null
        const at = place(piece)
        const chosen = pickedOpening === opening.id
        return (
          <mesh
            key={piece.key}
            position={toWorld(at.x, at.y, wall.baseOffset + opening.height / 2)}
            rotation={[0, angle + (piece.turn ?? 0), 0]}
            onClick={picker(opening)}
          >
            <boxGeometry args={[piece.length * MM, piece.height * MM, piece.thickness * MM]} />
            <meshLambertMaterial
              color={
                chosen
                  ? EMPHASIS.picked.fill
                  : opening.variant === 'garage'
                    ? PAINT.garage
                    : PAINT.leaf
              }
            />
          </mesh>
        )
      })}
      {openings
        .filter((opening) => opening.kind === 'window')
        .map((opening) => {
          const at = place({ at: growA + opening.t * span })
          const chosen = pickedOpening === opening.id
          return (
            <mesh
              key={`${opening.id}-glass`}
              position={toWorld(
                at.x,
                at.y,
                wall.baseOffset + opening.sillHeight + opening.height / 2,
              )}
              rotation={[0, angle, 0]}
              onClick={picker(opening)}
            >
              <boxGeometry args={[opening.width * MM, opening.height * MM, 0.04]} />
              <meshLambertMaterial
                color={chosen ? EMPHASIS.picked.glass : PAINT.glass}
                transparent
                opacity={0.45}
              />
            </mesh>
          )
        })}
    </>
  )
}
