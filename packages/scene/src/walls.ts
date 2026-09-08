import type { HouseDocument, Wall } from '@houseit/core/document'
import { doorPieces } from './doors'
import { owned, type Piece } from './pieces'
import { solidPieces } from './wall-pieces'

const PAINT = {
  wall: '#f1f0ed',
  glass: '#a7c8e6',
} as const

const PANE = 40

export function wallPieces(doc: HouseDocument, level: string): Piece[] {
  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)
  const degrees = new Map<string, number>()
  for (const wall of walls) {
    for (const node of [wall.a, wall.b]) degrees.set(node, (degrees.get(node) ?? 0) + 1)
  }
  return walls.flatMap((wall) => standingWall(doc, wall, degrees))
}

function standingWall(doc: HouseDocument, wall: Wall, degrees: Map<string, number>): Piece[] {
  const a = doc.nodes[wall.a]
  const b = doc.nodes[wall.b]
  if (!a || !b) return []
  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy)
  if (span === 0) return []
  const growA = (degrees.get(wall.a) ?? 0) > 1 ? wall.thickness / 2 : 0
  const growB = (degrees.get(wall.b) ?? 0) > 1 ? wall.thickness / 2 : 0
  const length = span + growA + growB
  const angle = Math.atan2(dy, dx)

  const openings = Object.values(doc.openings).filter((opening) => opening.wall === wall.id)

  const place = (at: number, aside = 0) => ({
    x: a.x + (at - growA) * (dx / span) - aside * (dy / span),
    y: a.y + (at - growA) * (dy / span) + aside * (dx / span),
  })

  const standing = (at: number, aside: number, up: number) => {
    const on = place(at, aside)
    return { x: on.x, y: up, z: -on.y }
  }

  const solids = owned(
    { kind: 'wall', id: wall.id },
    solidPieces(wall, openings, length, growA, span).map((piece) => ({
      body: {
        kind: 'box' as const,
        width: piece.length,
        height: piece.height,
        depth: piece.thickness,
      },
      at: standing(piece.at, 0, wall.baseOffset + piece.base + piece.height / 2),
      turn: angle,
      paint: { colour: PAINT.wall },
    })),
  )

  const leaves = openings.flatMap((opening) =>
    owned(
      { kind: 'opening', id: opening.id },
      doorPieces(opening, wall, growA + opening.t * span).map((piece) => ({
        body: {
          kind: 'box' as const,
          width: piece.length,
          height: piece.height,
          depth: piece.thickness,
        },
        at: standing(piece.at, piece.aside, wall.baseOffset + piece.base + piece.height / 2),
        turn: angle + piece.turn,
        paint: { colour: piece.colour },
      })),
    ),
  )

  const panes = openings
    .filter((opening) => opening.kind === 'window')
    .map((opening) => ({
      body: {
        kind: 'box' as const,
        width: opening.width,
        height: opening.height,
        depth: PANE,
      },
      at: standing(
        growA + opening.t * span,
        0,
        wall.baseOffset + opening.sillHeight + opening.height / 2,
      ),
      turn: angle,
      paint: { colour: PAINT.glass, opacity: 0.45 },
      of: { kind: 'opening' as const, id: opening.id },
    }))

  return [...solids, ...leaves, ...panes]
}
