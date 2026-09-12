import type { HouseDocument, Wall } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import { frameOffset, openingParts } from '@houseit/core/opening-parts'
import { exteriorSides } from '@houseit/geometry/exterior'
import { roomsOf } from '@houseit/geometry/rooms'
import { wallCaps } from '@houseit/geometry/wall-caps'
import { doorPieces } from './doors'
import { besideWall, type Dressed, paintFor } from './dressing'
import { owned, type Piece } from './pieces'
import { solidPieces } from './wall-pieces'

const PAINT = {
  wall: '#f1f0ed',
  glass: '#a7c8e6',
} as const

const PANE = 40

export function wallPieces(doc: HouseDocument, level: string): Piece[] {
  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)
  const dressed: Dressed[] = roomsOf(doc, level).map((room) => ({
    outline: room.nodes.map((id) => doc.nodes[id]!),
    worn: room.id === undefined ? undefined : doc.rooms[room.id],
  }))
  const outside = exteriorSides(doc, level)
  const built = walls.flatMap((wall) => standingWall(doc, wall, dressed, outside.get(wall.id)))
  const outward = (piece: Piece) => {
    if (piece.of?.kind !== 'wall') return false
    const wall = doc.walls[piece.of.id]!,
      side = outside.get(wall.id)
    if (side === undefined) return false
    const a = doc.nodes[wall.a]!,
      b = doc.nodes[wall.b]!
    return ((b.x - a.x) * (-piece.at.z - a.y) - (b.y - a.y) * (piece.at.x - a.x)) * side > 0
  }
  // At a corner the outside face owns the join; an inward room finish must
  // not colour the projecting end of the perpendicular wall on the facade.
  return built.sort((a, b) => Number(outward(b)) - Number(outward(a)))
}

function standingWall(
  doc: HouseDocument,
  wall: Wall,
  dressed: Dressed[],
  outside: 1 | -1 | undefined,
): Piece[] {
  const a = doc.nodes[wall.a]
  const b = doc.nodes[wall.b]
  if (!a || !b) return []
  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy)
  if (span === 0) return []
  const { growA, growB } = wallCaps(doc, wall)
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

  // Full-height walls meet the soffit; a separately specified clear height
  // leaves the slab and the buildup above it outside the wall's finish.
  const level = doc.levels[wall.level]
  const height = level ? Math.min(wall.height, soffitOf(level) - wall.baseOffset) : wall.height
  const built = height > 0 ? solidPieces({ ...wall, height }, openings, length, growA, span) : []
  const worn = besideWall(dressed, a, b, wall.thickness)

  const solids = owned(
    { kind: 'wall', id: wall.id },
    built.flatMap((piece) => {
      return ([1, -1] as const).map((side, nth) => ({
        body: {
          kind: 'box' as const,
          width: piece.length,
          height: piece.height,
          depth: piece.thickness / 2,
        },
        at: standing(
          piece.at,
          (side * piece.thickness) / 4,
          wall.baseOffset + piece.base + piece.height / 2,
        ),
        turn: angle,
        paint: paintFor(worn[nth]?.walls, PAINT.wall, {
          width: piece.length,
          height: piece.height,
        }),
      }))
    }),
  )

  const parts = openings.flatMap((o) => openingParts(o, span))
  const leaves = parts.flatMap((opening) => {
    const into = opening.kind === 'door' ? worn[opening.swing > 0 ? 0 : 1] : undefined
    return owned(
      { kind: 'opening', id: opening.id },
      doorPieces(opening, wall, growA + opening.t * span, outside).map((piece) => ({
        body: {
          kind: 'box' as const,
          width: piece.length,
          height: piece.height,
          depth: piece.thickness,
        },
        at: standing(
          piece.at,
          piece.aside + frameOffset(opening, wall, outside),
          wall.baseOffset + piece.base + piece.height / 2,
        ),
        turn: angle + piece.turn,
        paint: opening.frame
          ? {
              colour: piece.takesFinish ? PAINT.glass : piece.colour,
              ...(piece.takesFinish ? { opacity: 0.45 } : {}),
            }
          : piece.takesFinish
            ? paintFor(into?.doors, piece.colour, { width: piece.length, height: piece.height })
            : { colour: piece.colour },
      })),
    )
  })

  const panes = parts
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
        frameOffset(opening, wall, outside),
        wall.baseOffset + opening.sillHeight + opening.height / 2,
      ),
      turn: angle,
      paint:
        opening.infill === 'opaque'
          ? { colour: opening.frame?.outside ?? '#b0b0b0' }
          : opening.infill === 'frosted'
            ? { colour: '#dce5e8', opacity: 0.92 }
            : { colour: PAINT.glass, opacity: 0.45 },
      of: { kind: 'opening' as const, id: opening.id },
    }))

  const facade: Piece[] = []
  if (wall.exterior && outside !== undefined) {
    const exterior = wall.exterior
    const thickness = exterior.layers.reduce((sum, layer) => sum + layer.thickness, 0)
    const edge = wall.thickness / 2 + thickness / 2
    for (const piece of built) {
      const extendA = piece.at - piece.length / 2 <= 0.01 ? thickness : 0
      const extendB = piece.at + piece.length / 2 >= length - 0.01 ? thickness : 0
      const cuts = [
        ...new Set([
          piece.base,
          piece.base + piece.height,
          ...exterior.bands
            .flatMap((band) => [band.from, band.to])
            .filter((height) => height > piece.base && height < piece.base + piece.height),
        ]),
      ].sort((a, b) => a - b)
      for (let i = 1; i < cuts.length; i += 1) {
        const from = cuts[i - 1]!
        const to = cuts[i]!
        const band = exterior.bands.find((band) => from >= band.from && to <= band.to)
        facade.push({
          body: {
            kind: 'box',
            width: piece.length + extendA + extendB,
            height: to - from,
            depth: thickness,
          },
          at: standing(
            piece.at + (extendB - extendA) / 2,
            outside * edge,
            wall.baseOffset + (from + to) / 2,
          ),
          turn: angle,
          paint: { colour: band?.colour ?? exterior.colour },
        })
      }
    }
  }
  const frames: Piece[] = parts.flatMap((opening) => {
    if (!opening.frame) return []
    const frame = opening.frame
    const centre = growA + opening.t * span
    const sill = opening.sillHeight
    const strips = [
      {
        at: centre - opening.width / 2 + frame.face / 2,
        base: sill,
        height: opening.height,
        width: frame.face,
      },
      {
        at: centre + opening.width / 2 - frame.face / 2,
        base: sill,
        height: opening.height,
        width: frame.face,
      },
      {
        at: centre,
        base: sill + opening.height - frame.face,
        height: frame.face,
        width: opening.width - 2 * frame.face,
      },
      ...(opening.kind === 'door'
        ? []
        : [{ at: centre, base: sill, height: frame.face, width: opening.width - 2 * frame.face }]),
    ]
    return strips.flatMap((strip) =>
      ([1, -1] as const).map((side) => ({
        body: {
          kind: 'box' as const,
          width: strip.width,
          height: strip.height,
          depth: frame.depth / 2,
        },
        at: standing(
          strip.at,
          (side * frame.depth) / 4 + frameOffset(opening, wall, outside),
          wall.baseOffset + strip.base + strip.height / 2,
        ),
        turn: angle,
        paint: { colour: side === outside ? frame.outside : frame.inside },
        of: { kind: 'opening' as const, id: opening.id.split('-panel-')[0]! },
      })),
    )
  })
  return [
    ...solids,
    ...leaves,
    ...panes,
    ...frames,
    ...owned({ kind: 'wall', id: wall.id }, facade),
  ]
}
