import type { HouseDocument, Side } from '@houseit/core/document'
import { type Layer, layerOf } from '@houseit/core/object-types'
import type { Room } from '@houseit/geometry/rooms'
import { type SideRun, sideRun, sideRuns } from '@houseit/geometry/sides'
import { freeSpans, type Span, spanAround } from '@houseit/geometry/spans'
import { reachOf } from '@houseit/geometry/standing'

export type Spot = { against?: Side; againstNth?: number; along: number; across?: number }

const ROWS = [undefined, 0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85]

const SIDES: Side[] = ['north', 'east', 'south', 'west']

export function placeAgainst(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  width: number,
  layer: Layer = 'floor',
  abuts = false,
  nth?: number,
  window?: { from: number; to: number },
): Spot[] {
  const run = sideRun(doc, level, room, side, nth)
  if (!run || run.length < width) return []
  const several = sideRuns(doc, level, room, side).length > 1

  const outside = window
    ? [
        { from: 0, to: window.from },
        { from: window.to, to: run.length },
      ].filter((span) => span.to > span.from)
    : []
  const gaps = wideEnough(
    freeSpans(run.length, [...occupied(doc, level, room, side, run, layer), ...outside]),
    width,
  )
  return gaps.flatMap((gap) =>
    alongOf(gap, width, run.length, abuts).map((at) => ({
      against: side,
      ...(several ? { againstNth: run.nth } : {}),
      along: at / run.length,
    })),
  )
}

function alongOf(gap: Span, width: number, length: number, abuts: boolean): number[] {
  const middle = (gap.from + gap.to) / 2
  const ends = [
    { at: gap.from + width / 2, beside: gap.from > 0 },
    { at: gap.to - width / 2, beside: gap.to < length },
  ]

  if (!abuts) return [middle, ...ends.map((end) => end.at)]

  return [...ends.filter((end) => end.beside), ...ends.filter((end) => !end.beside)]
    .map((end) => end.at)
    .concat(middle)
}

export function placeSomewhereAgainst(
  doc: HouseDocument,
  level: string,
  room: Room,
  width: number,
  layer: Layer = 'floor',
  abuts = false,
): Spot[] {
  return SIDES.flatMap((side) =>
    sideRuns(doc, level, room, side).flatMap((run) =>
      placeAgainst(doc, level, room, side, width, layer, abuts, run.nth),
    ),
  )
}

export function placeFree(
  doc: HouseDocument,
  room: Room,
  width: number,
  layer: Layer = 'floor',
): Spot[] {
  const span = freeWidth(doc, room)
  if (span < width) return []

  const taken = Object.values(doc.objects)
    .filter(
      (object) => object.room === room.id && !object.against && layerOf(object.type) === layer,
    )
    .map((object) => spanAround(object.along * span, reachOf(object).across))

  const alongs = wideEnough(freeSpans(span, taken), width).flatMap((gap) =>
    acrossGap(gap, width).map((at) => at / span),
  )
  return ROWS.flatMap((across) =>
    alongs.map((along) => (across === undefined ? { along } : { along, across })),
  )
}

function acrossGap(gap: Span, width: number): number[] {
  const step = 250
  const middle = (gap.from + gap.to) / 2
  const reach = (gap.to - gap.from - width) / 2
  const offsets = [0]
  for (let out = step; out <= reach; out += step) offsets.push(out, -out)
  return offsets.map((offset) => middle + offset)
}

function wideEnough(spans: Span[], width: number): Span[] {
  return spans
    .filter((span) => span.to - span.from >= width)
    .sort((one, other) => other.to - other.from - (one.to - one.from))
}

export function freeWidth(doc: HouseDocument, room: Room): number {
  const xs = room.nodes.map((node) => doc.nodes[node]?.x ?? 0)
  return Math.max(...xs) - Math.min(...xs)
}

function occupied(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  run: SideRun,
  layer: Layer,
): Span[] {
  const longest = sideRun(doc, level, room, side)
  const objects = Object.values(doc.objects)
    .filter(
      (object) =>
        object.room === room.id &&
        object.against === side &&
        (object.againstNth ?? longest?.nth) === run.nth &&
        layerOf(object.type) === layer,
    )
    .map((object) => spanAround(object.along * run.length, reachOf(object).across))

  const unit = {
    x: (run.to.x - run.from.x) / (run.length || 1),
    y: (run.to.y - run.from.y) / (run.length || 1),
  }
  const doors = Object.values(doc.openings)
    .filter((opening) => opening.kind === 'door' && doc.walls[opening.wall]?.level === level)
    .flatMap((opening) => {
      const wall = doc.walls[opening.wall]!
      const a = doc.nodes[wall.a]
      const b = doc.nodes[wall.b]
      if (!a || !b) return []
      const at = { x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t }
      const distance = (at.x - run.from.x) * unit.x + (at.y - run.from.y) * unit.y
      const off = Math.abs((at.x - run.from.x) * unit.y - (at.y - run.from.y) * unit.x)
      return off <= 1 ? [spanAround(distance, opening.width)] : []
    })

  return [...objects, ...doors]
}
