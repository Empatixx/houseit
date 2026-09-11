import type { HouseDocument } from '@houseit/core/document'
import { anchorInside } from '@houseit/geometry/anchor'
import type { Axis } from '@houseit/geometry/cut'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import type { Draft as ImmerDraft } from 'immer'
import { allocateId } from '../allocate-id'
import { CommandError } from '../command-error'

export type Draft = Parameters<typeof roomsOf>[0]

export function settlePieces(
  draft: Draft,
  level: string,
  source: Room & { id: string },
  outline: Point[],
  name: string,
  material: string,
  isNew: ((anchor: Point) => boolean) | undefined,
): string[] {
  const pieces = roomsOf(draft, level)
    .map((face) => ({
      face,
      anchor: anchorInside(
        face.nodes.map((node) => draft.nodes[node]!),
        face.area,
      ),
    }))
    .filter(({ anchor }) => containsPoint(outline, anchor.x, anchor.y))
  if (pieces.length < 2) throw new CommandError('add-room: the walls closed no room off')

  const smallest = pieces.reduce((best, next) => (next.face.area < best.face.area ? next : best))
  const taken = pieces.filter(({ anchor }) => (isNew ? isNew(anchor) : false))
  const fresh = taken.length > 0 ? taken : [smallest]
  const rest = pieces.filter((piece) => !fresh.includes(piece))
  if (rest.length === 0) throw new CommandError('add-room: nothing of the old room would be left')

  const biggest = rest.reduce((best, next) => (next.face.area > best.face.area ? next : best))
  const record = draft.rooms[source.id]!
  record.x = biggest.anchor.x
  record.y = biggest.anchor.y

  const made = fresh.map(({ anchor }, index) => {
    const id = allocateId(draft.rooms, 'r')
    draft.rooms[id] = {
      id,
      level,
      ...anchor,
      name: index === 0 ? name : `${name} ${index + 1}`,
      floor: material,
      loop: [],
    }
    return id
  })
  const spare = rest
    .filter((piece) => piece !== biggest)
    .map(({ anchor }, index) => {
      const id = allocateId(draft.rooms, 'r')
      draft.rooms[id] = {
        id,
        level,
        ...anchor,
        name: `${source.name ?? 'room'} ${index + 2}`,
        floor: source.floor ?? material,
        loop: [],
      }
      return id
    })
  return [...made, ...spare, source.id]
}

export function settleCut(
  draft: Draft,
  level: string,
  source: Room,
  name: string,
  material: string,
  axis: Axis,
  at: number,
  fromLow: boolean,
): string[] {
  const faces = roomsOf(draft, level).filter((face) => !face.id || face.id === source.id)
  const near = faces.filter((face) => (fromLow ? face.centre[axis] < at : face.centre[axis] > at))
  const far = faces.filter((face) => !near.includes(face))
  if (near.length === 0 || far.length === 0) {
    throw new CommandError(`add-room: the cut left nothing on one side of it`)
  }

  const inside = (face: Room) =>
    anchorInside(
      face.nodes.map((node) => draft.nodes[node]!),
      face.area,
    )

  const made = near.map((face, index) => {
    const id = allocateId(draft.rooms, 'r')
    draft.rooms[id] = {
      id,
      level,
      ...inside(face),
      name: index === 0 ? name : `${name} ${index + 1}`,
      floor: material,
      loop: [],
    }
    return id
  })

  const rest = far.reduce((biggest, face) => (face.area > biggest.area ? face : biggest))
  const previous = source.id ? draft.rooms[source.id] : undefined
  if (previous) {
    const anchor = inside(rest)
    previous.x = anchor.x
    previous.y = anchor.y
  }
  const spare = far
    .filter((face) => face !== rest)
    .map((face, index) => {
      const id = allocateId(draft.rooms, 'r')
      draft.rooms[id] = {
        id,
        level,
        ...inside(face),
        name: `${source.name ?? 'room'} ${index + 2}`,
        floor: source.floor ?? material,
        loop: [],
      }
      return id
    })
  return [...made, ...spare, ...(source.id === undefined ? [] : [source.id])]
}

export function settle(
  draft: Draft,
  level: string,
  source: { id?: string },
  name: string,
  material: string,
  taken: { x: number; y: number },
  left: { x: number; y: number },
): string[] {
  const id = allocateId(draft.rooms, 'r')
  draft.rooms[id] = { id, level, x: taken.x, y: taken.y, name, floor: material, loop: [] }

  const previous = source.id ? draft.rooms[source.id] : undefined
  if (previous) {
    previous.x = left.x
    previous.y = left.y
  }
  return [id, ...(source.id === undefined ? [] : [source.id])]
}

export function named(
  draft: ImmerDraft<HouseDocument>,
  made: string[],
  kind: string | undefined,
): { changed: string[] } {
  const first = made[0]
  const record = first === undefined ? undefined : draft.rooms[first]
  if (kind !== undefined && record) record.kind = kind
  return { changed: made }
}
