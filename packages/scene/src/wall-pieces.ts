import type { Opening, Wall } from '@houseit/core/document'
import type { Enclosure } from '@houseit/geometry/enclosure'
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
  enclosure: Enclosure = 'wall',
): WallPiece[] {
  const line = lineWeight(wall.thickness)
  const inner = wall.thickness - 2 * line
  if (enclosure === 'edge') {
    return [
      {
        key: 'edge',
        colour: INK.outline,
        at: length / 2,
        length,
        thickness: line,
        base: 0,
        height: wall.height,
      },
    ]
  }
  const glazed = enclosure === 'glass'
  const holes = openings.map((opening) => spanAround(growA + opening.t * span, opening.width))
  const doorways = openings.flatMap((opening, index) =>
    opening.kind === 'door' ? [holes[index]!] : [],
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
      colour: glazed ? INK.glass : INK.wall,
      at: middleOf(solid),
      length: solid.to - solid.from,
      thickness: inner,
      base: 2,
      height: wall.height,
    })
    if (glazed) {
      pieces.push({
        key: `pane-${solid.from}`,
        colour: INK.outline,
        at: middleOf(solid),
        length: solid.to - solid.from,
        thickness: line,
        base: 4,
        height: wall.height,
      })
    }
  }

  openings.forEach((opening, index) => {
    const hole = holes[index]!
    const before = pieces.length
    drawOpening(opening, hole, line, inner, wall, pieces)
    for (const piece of pieces.slice(before)) piece.opening = opening.id
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
  const towards = opening.hinge === 'a' ? 1 : -1
  const first = pocket ? hole.from + width * 0.5 : hole.from + panel / 2
  const second = pocket ? hole.from - width * 0.5 : hole.to - panel / 2

  const panels: WallPiece[] = [
    { key: 'near', at: first, aside: -leaf / 2 },
    { key: 'far', at: second, aside: leaf / 2 },
  ].flatMap(({ key, at, aside }) => [
    {
      key: `${opening.id}-${key}`,
      colour: INK.outline,
      at: at * 1 + 0 * towards,
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

  return pocket ? panels.slice(0, 2) : panels
}

function swingOf(opening: Opening, hole: Span, line: number, wall: Wall): WallPiece[] {
  const width = opening.width
  const swing = opening.swing
  const height = wall.height
  const face = wall.thickness / 2
  const hinge = opening.hinge === 'a' ? hole.from : hole.to
  const towards = opening.hinge === 'a' ? 1 : -1
  const leaf = wall.thickness / 2
  const stile = hinge + (towards * leaf) / 2
  const reach = width + wall.thickness
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
