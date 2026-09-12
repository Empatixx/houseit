import type { Opening, Wall } from '@houseit/core/document'
import { doorLeafSize, frameOffset, openingParts, pocketShift } from '@houseit/core/opening-parts'
import { freeSpans, type Span, spanAround } from '@houseit/geometry/spans'

export const INK = {
  outline: '#212121',
  wall: '#212121',
  glass: '#ffffff',
  perspective: '#e7e5e4',
} as const

export const lineWeight = (thickness: number) => Math.max(15, Math.round(thickness / 8))

export type WallPiece = {
  key: string
  colour: string
  at: number
  length: number
  thickness: number
  base: number
  height: number
  aside?: number
  turn?: number
  opening?: string
  hidden?: boolean
}

const DASHES = 7
const QUARTER = Math.PI / 2

export function planPieces(
  wall: Wall,
  openings: Opening[],
  length: number,
  growA: number,
  span: number,
  outside?: 1 | -1,
): WallPiece[] {
  openings = openings.flatMap((o) =>
    openingParts(o, span).filter((p) => !o.panels || p.sillHeight < 1500),
  )
  const line = lineWeight(wall.thickness)
  const inner = wall.thickness - 2 * line
  const holes = openings.map((opening) => spanAround(growA + opening.t * span, opening.width))
  const doorways = openings.flatMap((opening, index) =>
    opening.kind === 'door' || (opening.frame?.inset !== undefined && opening.sillHeight === 0)
      ? [holes[index]!]
      : [],
  )

  const pieces: WallPiece[] = freeSpans(length, doorways).map((solid) => ({
    key: `outline-${solid.from}`,
    colour: INK.outline,
    at: middleOf(solid),
    length: solid.to - solid.from,
    thickness: wall.thickness,
    base: 0,
    height: wall.height,
  }))

  for (const solid of freeSpans(length, holes)) {
    pieces.push({
      key: `fill-${solid.from}`,
      colour: INK.wall,
      at: middleOf(solid),
      length: solid.to - solid.from,
      thickness: inner,
      base: 2,
      height: wall.height,
    })
  }

  if (wall.exterior && outside !== undefined) {
    const thickness = wall.exterior.layers.reduce((sum, layer) => sum + layer.thickness, 0)
    for (const solid of freeSpans(length, holes)) {
      const extendA = solid.from === 0 ? thickness : 0
      const extendB = solid.to === length ? thickness : 0
      pieces.push({
        key: `exterior-${solid.from}`,
        colour: '#aeb3ac',
        at: middleOf(solid) + (extendB - extendA) / 2,
        length: solid.to - solid.from + extendA + extendB,
        thickness,
        aside: (outside * (wall.thickness + thickness)) / 2,
        base: 0,
        height: wall.height,
      })
    }
  }
  openings.forEach((opening, index) => {
    const hole = holes[index]!
    const before = pieces.length
    drawOpening(opening, hole, line, inner, wall, pieces)
    if (opening.frame?.inset !== undefined && opening.sillHeight === 0) {
      const glass = pieces.findIndex((p, i) => i >= before && p.key === `${opening.id}-glass`)
      if (glass !== -1) pieces.splice(glass, 1)
    }
    for (const piece of pieces.slice(before)) {
      piece.opening = opening.id.split('-panel-')[0]!
      if (piece.key.endsWith('-glass')) continue
      piece.aside = (piece.aside ?? 0) + frameOffset(opening, wall, outside)
    }
  })

  return pieces
}

function drawOpening(
  opening: Opening,
  hole: Span,
  line: number,
  inner: number,
  wall: Wall,
  pieces: WallPiece[],
): void {
  if (opening.kind === 'window') {
    if (opening.frame)
      for (const at of [hole.from + opening.frame.face / 2, hole.to - opening.frame.face / 2])
        pieces.push({
          key: `${opening.id}-stile-${at}`,
          colour: INK.outline,
          at,
          length: opening.frame.face,
          thickness: opening.frame.depth,
          base: 6,
          height: wall.height,
        })
    pieces.push(
      {
        key: `${opening.id}-glass`,
        colour: INK.glass,
        at: middleOf(hole),
        length: opening.width,
        thickness: inner,
        base: 2,
        height: wall.height,
      },
      {
        key: `${opening.id}-pane`,
        colour: INK.outline,
        at: middleOf(hole),
        length: opening.width,
        thickness: line,
        base: 4,
        height: wall.height,
      },
    )
    return
  }

  if (opening.variant === 'garage') {
    pieces.push(...garageOf(opening, hole, line, wall))
    return
  }
  if (opening.variant === 'sliding' || opening.variant === 'pocket') {
    pieces.push(...slidingOf(opening, hole, line, wall))
    return
  }
  pieces.push(...swingOf(opening, hole, line, wall))
  pieces.push({
    key: `${opening.id}-pick`,
    colour: INK.glass,
    at: middleOf(hole),
    length: opening.width,
    thickness: wall.thickness,
    base: 0,
    height: wall.height,
    hidden: true,
  })
}

function garageOf(opening: Opening, hole: Span, line: number, wall: Wall): WallPiece[] {
  const inner = wall.thickness - 2 * line
  return [
    {
      key: `${opening.id}-panel`,
      colour: INK.glass,
      at: middleOf(hole),
      length: opening.width,
      thickness: inner,
      base: 2,
      height: wall.height,
    },
    {
      key: `${opening.id}-line`,
      colour: INK.outline,
      at: middleOf(hole),
      length: opening.width,
      thickness: line,
      base: 4,
      height: wall.height,
    },
  ]
}

function slidingOf(opening: Opening, hole: Span, line: number, wall: Wall): WallPiece[] {
  const width = opening.width
  const leaf = Math.max(line * 2, wall.thickness / 3)
  const pocket = opening.variant === 'pocket'
  const panel = pocket ? width : width / 2 + line
  const first = pocket ? middleOf(hole) + pocketShift(opening) : hole.from + panel / 2
  const second = pocket ? hole.from - width * 0.5 : hole.to - panel / 2

  const panels: WallPiece[] = [
    { key: 'near', at: first, aside: -leaf / 2 },
    { key: 'far', at: second, aside: leaf / 2 },
  ].flatMap(({ key, at, aside }) => [
    {
      key: `${opening.id}-${key}`,
      colour: INK.outline,
      at,
      aside,
      length: panel,
      thickness: leaf,
      base: 4,
      height: wall.height,
    },
    {
      key: `${opening.id}-${key}-fill`,
      colour: INK.glass,
      at,
      aside,
      length: panel - 2 * line,
      thickness: Math.max(1, leaf - 2 * line),
      base: 6,
      height: wall.height,
    },
  ])

  return pocket
    ? [
        ...panels.slice(0, 2),
        {
          key: `${opening.id}-pick`,
          colour: INK.glass,
          at: middleOf(hole),
          length: width,
          thickness: wall.thickness,
          base: 0,
          height: wall.height,
          hidden: true,
        },
      ]
    : panels
}

function swingOf(opening: Opening, hole: Span, line: number, wall: Wall): WallPiece[] {
  const { width, inset } = doorLeafSize(opening)
  if (opening.frame) line = Math.min(line, opening.frame.depth / 3)
  const swing = opening.swing
  const height = wall.height
  const face = opening.frame ? 0 : wall.thickness / 2
  const hinge = opening.hinge === 'a' ? hole.from + inset : hole.to - inset
  const towards = opening.hinge === 'a' ? 1 : -1
  const leaf = opening.frame?.depth ?? wall.thickness / 2
  const stile = hinge + (towards * leaf) / 2
  const reach = width + 2 * face
  const stands = swing * (reach / 2 - face)

  const pieces: WallPiece[] = [
    {
      key: `${opening.id}-leaf`,
      colour: INK.outline,
      at: stile,
      aside: stands,
      turn: QUARTER,
      length: reach,
      thickness: leaf,
      base: 4,
      height,
    },
    {
      key: `${opening.id}-leaf-fill`,
      colour: INK.glass,
      at: stile,
      aside: stands,
      turn: QUARTER,
      length: reach - 2 * line,
      thickness: leaf - 2 * line,
      base: 6,
      height,
    },
  ]

  const radius = width - line / 2
  const step = QUARTER / (2 * DASHES - 1)

  for (let i = 0; i < DASHES; i += 1) {
    const angle = (2 * i + 0.5) * step
    const run = radius * Math.cos(angle)
    const drop = radius * Math.sin(angle)
    pieces.push({
      key: `${opening.id}-arc-${i}`,
      colour: INK.outline,
      at: hinge + towards * drop,
      aside: swing * (face + run),
      turn: Math.atan2(-swing * drop, towards * run),
      length: step * radius,
      thickness: line,
      base: 4,
      height,
    })
  }

  return pieces
}

export function solidPieces(
  wall: Wall,
  openings: Opening[],
  length: number,
  growA: number,
  span: number,
): WallPiece[] {
  const holes = openings.map((opening) => spanAround(growA + opening.t * span, opening.width))

  const pieces: WallPiece[] = freeSpans(length, holes).map((solid) => ({
    key: `solid-${solid.from}`,
    colour: INK.perspective,
    at: middleOf(solid),
    length: solid.to - solid.from,
    thickness: wall.thickness,
    base: 0,
    height: wall.height,
  }))

  openings.forEach((opening, index) => {
    const head = opening.sillHeight + opening.height
    const spans = [
      { name: 'sill', base: 0, height: opening.sillHeight },
      { name: 'head', base: head, height: wall.height - head },
    ]

    for (const part of spans) {
      if (part.height <= 0) continue
      pieces.push({
        key: `${opening.id}-${part.name}`,
        colour: INK.perspective,
        at: middleOf(holes[index]!),
        length: opening.width,
        thickness: wall.thickness,
        base: part.base,
        height: part.height,
      })
    }
  })

  return pieces
}

const middleOf = (span: Span) => (span.from + span.to) / 2
