import type { HouseDocument, Level } from '@houseit/core/document'
import { flightOf, levelsOf } from '@houseit/core/levels'
import { planExtent } from '@houseit/geometry/dimensions'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { elementId, wallElement } from '@houseit/geometry/wall-elements'
import { produce } from 'immer'
import { applyScript } from './apply-script'
import { checkLevel, type Problem } from './checks'
import type { Touched } from './define-command'
import { roomOfOpening } from './openings'
import { type RoomReport, surveyRoom } from './survey'

export type StoreyReport = {
  id: string
  name: string
  storey: number
  height: number
  elevation: number
  slabThickness?: number
  roofs?: Level['roofs']
  shafts?: Level['shafts']
  ramps?: Level['ramps']
  clearHeight?: number
  stairs?: Level['stairs']
  columns?: (NonNullable<Level['columns']>[number] & { height: number })[]
  risers: number
  rooms: number
  open?: true
}

export type WallReport = {
  id: string
  level: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  length: number
  segments: {
    id: string
    from: number
    to: number
    thickness: number
    height: number
    base: number
  }[]
  openings: (HouseDocument['openings'][string] & { at: number })[]
  devices: (HouseDocument['devices'][string] & { at: number })[]
}

function surveyWalls(doc: HouseDocument, level: string): WallReport[] {
  const ids = new Set(
    Object.values(doc.walls)
      .filter((w) => w.level === level)
      .map(elementId),
  )
  return [...ids].map((id) => {
    const e = wallElement(doc, id)
    return {
      id,
      level,
      from: { x: e.from.x, y: e.from.y },
      to: { x: e.to.x, y: e.to.y },
      length: e.length,
      segments: e.segments.map(({ wall, from, to }) => ({
        id: wall.id,
        from,
        to,
        thickness: wall.thickness,
        height: wall.height,
        base: wall.baseOffset,
      })),
      devices: e.segments.flatMap(({ wall, from, to }) =>
        Object.values(doc.devices).flatMap((d) =>
          d.host.kind === 'wall' && d.host.wall === wall.id
            ? [{ ...d, at: from + (to - from) * d.host.t }]
            : [],
        ),
      ),
      openings: e.segments.flatMap(({ wall, from, to }) =>
        Object.values(doc.openings)
          .filter((o) => o.wall === wall.id)
          .map((o) => ({ ...o, at: from + (to - from) * o.t })),
      ),
    }
  })
}

export type Answer = {
  site?: HouseDocument['site']
  level: string
  levels: StoreyReport[]
  width?: number
  depth?: number
  changed: string[]
  walls: WallReport[]
  rooms: RoomReport[]
  unassigned?: RoomReport[]
  problems: Problem[]
  notes?: string[]
}

export function answerFor(
  doc: HouseDocument,
  open: string,
  changed: string[],
  shown: string[] = [],
  about?: string,
  notes?: string[],
): Answer {
  const touched: { room: Room; level: string }[] = []
  for (const id of [...changed, ...shown]) {
    const found = roomBehind(doc, open, id)
    if (found && !touched.some((seen) => seen.room.id === found.room.id)) touched.push(found)
  }

  const level = about ?? touched[0]?.level ?? open
  const extent = planExtent(doc, level)
  const levelRooms = roomsOf(doc, level)
  const unassigned = levelRooms.filter((room) => room.id === undefined)
  return {
    level,
    ...(doc.site ? { site: doc.site } : {}),
    levels: levelsOf(doc).map((storey, index) => ({
      id: storey.id,
      name: storey.name,
      storey: index + 1,
      height: storey.height,
      ...(storey.shafts ? { shafts: storey.shafts } : {}),
      ...(storey.ramps ? { ramps: storey.ramps } : {}),
      ...(storey.clearHeight === undefined ? {} : { clearHeight: storey.clearHeight }),
      ...(storey.stairs ? { stairs: storey.stairs } : {}),
      ...(storey.columns
        ? {
            columns: storey.columns.map((c) => ({
              ...c,
              height: soffitOf(storey),
            })),
          }
        : {}),
      ...(storey.slabThickness === undefined ? {} : { slabThickness: storey.slabThickness }),
      ...(storey.roofs === undefined ? {} : { roofs: storey.roofs }),
      elevation: storey.elevation,
      risers: flightOf(storey.height).risers,
      rooms: roomsOf(doc, storey.id).length,
      ...(storey.id === level ? { open: true as const } : {}),
    })),
    ...(extent
      ? { width: Math.round(extent.x1 - extent.x0), depth: Math.round(extent.y1 - extent.y0) }
      : {}),
    changed,
    walls: surveyWalls(doc, level),
    rooms: touched.map((it) => surveyRoom(doc, it.level, it.room, roomsOf(doc, it.level))),
    ...(unassigned.length
      ? {
          unassigned: unassigned.map((room) => surveyRoom(doc, level, room, levelRooms)),
        }
      : {}),
    problems: checkLevel(doc, level),
    ...(notes === undefined || notes.length === 0 ? {} : { notes }),
  }
}

function roomBehind(
  doc: HouseDocument,
  open: string,
  id: string,
): { room: Room; level: string } | undefined {
  const stored = doc.rooms[id]
  const object = doc.objects[id]
  const opening = doc.openings[id]
  const level =
    stored?.level ?? object?.level ?? (opening ? doc.walls[opening.wall]?.level : undefined) ?? open

  const rooms = roomsOf(doc, level)
  if (stored) {
    const room = rooms.find((candidate) => candidate.id === id)
    return room ? { room, level } : undefined
  }
  if (opening) {
    const room = roomOfOpening(doc, rooms, opening)
    return room ? { room, level } : undefined
  }
  if (object) {
    const room = rooms.find((candidate) => candidate.id === object.room)
    return room ? { room, level } : undefined
  }
  return undefined
}

export function askPlan(doc: HouseDocument, source: string, open?: string): Answer {
  let touched: Touched = { changed: [], shown: [] }
  const next = produce(doc, (draft) => {
    touched = applyScript(draft, source, open)
  })
  return answerFor(
    next,
    open ?? levelsOf(next)[0]!.id,
    touched.changed,
    touched.shown,
    touched.at,
    touched.notes,
  )
}

import { soffitOf } from '@houseit/core/levels'
