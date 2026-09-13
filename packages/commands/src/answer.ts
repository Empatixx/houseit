import type { HouseDocument } from '@houseit/core/document'
import { flightOf, levelsOf } from '@houseit/core/levels'
import { planExtent } from '@houseit/geometry/dimensions'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { produce } from 'immer'
import { applyScript } from './apply-script'
import { checkLevel, type Problem } from './checks'
import type { Touched } from './define-command'
import { roomOfOpening } from './openings'
import { assertHouseFitsSite } from './site-invariant'
import { type RoomReport, surveyRoom } from './survey'

export type StoreyReport = {
  id: string
  name: string
  storey: number
  height: number
  elevation: number
  risers: number
  rooms: number
  open?: true
}

export type Answer = {
  level: string
  levels: StoreyReport[]
  width?: number
  depth?: number
  changed: string[]
  rooms: RoomReport[]
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
  return {
    level,
    levels: levelsOf(doc).map((storey, index) => ({
      id: storey.id,
      name: storey.name,
      storey: index + 1,
      height: storey.height,
      elevation: storey.elevation,
      risers: flightOf(storey.height).risers,
      rooms: roomsOf(doc, storey.id).length,
      ...(storey.id === level ? { open: true as const } : {}),
    })),
    ...(extent
      ? { width: Math.round(extent.x1 - extent.x0), depth: Math.round(extent.y1 - extent.y0) }
      : {}),
    changed,
    rooms: touched.map((it) => surveyRoom(doc, it.level, it.room, roomsOf(doc, it.level))),
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
    assertHouseFitsSite(draft)
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
