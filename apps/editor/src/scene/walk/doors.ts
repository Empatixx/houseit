import type { Opening, Wall } from '@houseit/core/document'

const DOOR_PAINT = {
  leaf: '#cdb894',
  garage: '#f5f5f4',
  handle: '#6b6b6b',
  lining: '#e6e3dd',
} as const

const LEAF = 40
const LINING = 40
const HANDLE = { reach: 70, length: 130, thick: 26, height: 1020 }
const QUARTER = Math.PI / 2

export type StandingPiece = {
  key: string
  at: number
  aside: number
  turn: number
  length: number
  height: number
  thickness: number
  base: number
  colour: string
}

export function doorPieces(opening: Opening, wall: Wall, centre: number): StandingPiece[] {
  if (opening.kind !== 'door') return []
  const width = opening.width
  const height = opening.height
  const face = wall.thickness / 2
  const lining = liningOf(opening, wall, centre)

  if (opening.variant === 'garage') {
    return [
      ...lining,
      {
        key: `${opening.id}-panel`,
        at: centre,
        aside: 0,
        turn: 0,
        length: width,
        height: height - LINING,
        thickness: LEAF,
        base: 0,
        colour: DOOR_PAINT.garage,
      },
    ]
  }

  if (opening.variant === 'sliding' || opening.variant === 'pocket') {
    const panel = opening.variant === 'pocket' ? width : width / 2
    const spots =
      opening.variant === 'pocket'
        ? [{ key: 'near', at: centre, aside: 0 }]
        : [
            { key: 'near', at: centre - width / 4, aside: -LEAF / 2 },
            { key: 'far', at: centre + width / 4, aside: LEAF / 2 },
          ]
    return [
      ...lining,
      ...spots.map((spot) => ({
        key: `${opening.id}-${spot.key}`,
        at: spot.at,
        aside: spot.aside,
        turn: 0,
        length: panel,
        height: height - LINING,
        thickness: LEAF,
        base: 0,
        colour: DOOR_PAINT.leaf,
      })),
    ]
  }

  const towards = opening.hinge === 'a' ? 1 : -1
  const hinge = centre - (towards * width) / 2
  const swing = opening.swing
  const stile = hinge + (towards * LEAF) / 2

  return [
    ...lining,
    {
      key: `${opening.id}-leaf`,
      at: stile,
      aside: swing * (face + width / 2),
      turn: QUARTER,
      length: width,
      height,
      thickness: LEAF,
      base: 0,
      colour: DOOR_PAINT.leaf,
    },
    {
      key: `${opening.id}-handle`,
      at: stile + towards * (LEAF / 2 + HANDLE.reach / 2),
      aside: swing * (face + width - HANDLE.length / 2 - 60),
      turn: QUARTER,
      length: HANDLE.length,
      height: HANDLE.thick,
      thickness: HANDLE.reach,
      base: HANDLE.height,
      colour: DOOR_PAINT.handle,
    },
  ]
}

function liningOf(opening: Opening, wall: Wall, centre: number): StandingPiece[] {
  const width = opening.width
  const height = opening.height
  const jamb = (side: -1 | 1) => ({
    key: `${opening.id}-jamb-${side > 0 ? 'b' : 'a'}`,
    at: centre + (side * (width - LINING)) / 2,
    aside: 0,
    turn: 0,
    length: LINING,
    height,
    thickness: wall.thickness,
    base: 0,
    colour: DOOR_PAINT.lining,
  })
  return [
    jamb(-1),
    jamb(1),
    {
      key: `${opening.id}-soffit`,
      at: centre,
      aside: 0,
      turn: 0,
      length: width,
      height: LINING,
      thickness: wall.thickness,
      base: height - LINING,
      colour: DOOR_PAINT.lining,
    },
  ]
}
