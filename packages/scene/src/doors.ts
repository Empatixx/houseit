import type { Opening, Wall } from '@houseit/core/document'
import { doorLeafSize, type OpeningPart, pocketShift } from '@houseit/core/opening-parts'

const DOOR_PAINT = {
  leaf: '#cdb894',
  garage: '#f5f5f4',
  handle: '#6b6b6b',
  lining: '#e6e3dd',
} as const

const LEAF = 40
const LINING = 40
const HANDLE = { reach: 70, length: 130, thick: 22, height: 1020 }
const LEVER = { reach: 58, thick: 18, stem: 22 }
const PLATE = { width: 45, height: 180, thick: 8 }
const ARCHITRAVE = { width: 70, proud: 12, lap: 10 }
const HINGE = { size: 18, height: 100 }
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
  takesFinish?: boolean
}

export function doorPieces(
  opening: OpeningPart,
  wall: Wall,
  centre: number,
  outside?: -1 | 1,
): StandingPiece[] {
  if (opening.kind !== 'door') return []
  if (opening.frame && opening.variant === 'hinged') return framedLeaf(opening, centre, outside)
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
        takesFinish: true,
      },
    ]
  }

  if (opening.variant === 'sliding' || opening.variant === 'pocket') {
    const panel = opening.variant === 'pocket' ? width : width / 2
    const spots =
      opening.variant === 'pocket'
        ? [{ key: 'near', at: centre + pocketShift(opening), aside: 0 }]
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
        takesFinish: true,
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
      takesFinish: true,
    },
    ...hinges(opening.id, hinge, swing * face, height),
    ...([1, -1] as const).flatMap((side) =>
      lever(opening.id, stile, towards * side, swing, face + width - 60, side > 0 ? '' : '-back'),
    ),
  ]
}

function lever(
  id: string,
  stile: number,
  out: number,
  swing: 1 | -1,
  pivot: number,
  suffix: string,
): StandingPiece[] {
  const across = (reach: number) => stile + out * (LEAF / 2 + reach)
  const handle = {
    turn: QUARTER,
    colour: DOOR_PAINT.handle,
  }
  return [
    {
      ...handle,
      key: `${id}-plate${suffix}`,
      at: across(PLATE.thick / 2),
      aside: swing * pivot,
      length: PLATE.width,
      height: PLATE.height,
      thickness: PLATE.thick,
      base: HANDLE.height - PLATE.height / 2 + HANDLE.thick / 2,
    },
    {
      ...handle,
      key: `${id}-stem${suffix}`,
      at: across(LEVER.reach / 2),
      aside: swing * pivot,
      length: LEVER.stem,
      height: LEVER.stem,
      thickness: LEVER.reach,
      base: HANDLE.height,
    },
    {
      ...handle,
      key: `${id}-handle${suffix}`,
      at: across(LEVER.reach - LEVER.thick / 2),
      aside: swing * (pivot - HANDLE.length / 2 + LEVER.stem / 2),
      length: HANDLE.length,
      height: HANDLE.thick,
      thickness: LEVER.thick,
      base: HANDLE.height,
    },
  ]
}

function hinges(id: string, at: number, aside: number, height: number): StandingPiece[] {
  return [150, height / 2 - HINGE.height / 2, height - 250].map((base, n) => ({
    key: `${id}-hinge-${n + 1}`,
    at,
    aside,
    turn: 0,
    length: HINGE.size,
    height: HINGE.height,
    thickness: HINGE.size,
    base,
    colour: DOOR_PAINT.handle,
  }))
}

function framedLeaf(opening: Opening, centre: number, outside?: -1 | 1): StandingPiece[] {
  const frame = opening.frame!
  const { width, height } = doorLeafSize(opening)
  const towards = opening.hinge === 'a' ? 1 : -1
  const swing = opening.swing
  const hinge = centre - (towards * width) / 2
  const at = hinge + (towards * frame.depth) / 2
  const exterior = -(outside ?? -swing) * swing * towards
  const strips = [
    { along: frame.face / 2, length: frame.face, base: 0, height },
    { along: width - frame.face / 2, length: frame.face, base: 0, height },
    { along: width / 2, length: width - 2 * frame.face, base: 0, height: frame.face },
    {
      along: width / 2,
      length: width - 2 * frame.face,
      base: height - frame.face,
      height: frame.face,
    },
  ]
  const infill: StandingPiece = {
    key: `${opening.id}-leaf`,
    at,
    aside: (swing * width) / 2,
    turn: QUARTER,
    length: width - 2 * frame.face,
    height: height - 2 * frame.face,
    thickness: 8,
    base: frame.face,
    colour: '#b9d4e0',
    takesFinish: true,
  }
  return [
    ...(opening.infill === 'opaque'
      ? ([1, -1] as const).map((side) => ({
          ...infill,
          key: `${opening.id}-leaf-${side}`,
          at: at + (side * LEAF) / 4,
          thickness: LEAF / 2,
          colour: side === exterior ? frame.outside : frame.inside,
          takesFinish: false,
        }))
      : [infill]),
    ...strips.flatMap((strip, i) =>
      ([1, -1] as const).map((side) => ({
        key: `${opening.id}-leaf-frame-${i}-${side}`,
        at: at + (side * frame.depth) / 4,
        aside: swing * strip.along,
        turn: QUARTER,
        length: strip.length,
        height: strip.height,
        thickness: frame.depth / 2,
        base: strip.base,
        colour: side === exterior ? frame.outside : frame.inside,
      })),
    ),
    {
      key: `${opening.id}-handle`,
      at: at + (towards * (frame.depth + HANDLE.reach)) / 2,
      aside: swing * (width - HANDLE.length / 2 - frame.face),
      turn: QUARTER,
      length: HANDLE.length,
      height: HANDLE.thick,
      thickness: HANDLE.reach,
      base: HANDLE.height,
      colour: DOOR_PAINT.handle,
    },
  ]
}

function liningOf(opening: OpeningPart, wall: Wall, centre: number): StandingPiece[] {
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
  const sides = ([-1, 1] as const).filter((side) => opening.liningSide !== (side < 0 ? 'b' : 'a'))
  const architraves = ([1, -1] as const).flatMap((face) => {
    const aside = face * (wall.thickness / 2 + ARCHITRAVE.proud / 2)
    const name = face > 0 ? 'front' : 'back'
    return [
      ...sides.map((side) => ({
        key: `${opening.id}-architrave-${side > 0 ? 'b' : 'a'}-${name}`,
        at: centre + side * (width / 2 + ARCHITRAVE.width / 2 - ARCHITRAVE.lap),
        aside,
        turn: 0,
        length: ARCHITRAVE.width,
        height: height + ARCHITRAVE.width - ARCHITRAVE.lap,
        thickness: ARCHITRAVE.proud,
        base: 0,
        colour: DOOR_PAINT.lining,
      })),
      {
        key: `${opening.id}-architrave-head-${name}`,
        at: centre,
        aside,
        turn: 0,
        length: width - 2 * ARCHITRAVE.lap,
        height: ARCHITRAVE.width,
        thickness: ARCHITRAVE.proud,
        base: height - ARCHITRAVE.lap,
        colour: DOOR_PAINT.lining,
      },
    ]
  })
  return [
    ...sides.map(jamb),
    ...architraves,
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
