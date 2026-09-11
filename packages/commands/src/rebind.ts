import type { HouseDocument } from '@houseit/core/document'
import { type Face, findFaces } from '@houseit/core/faces'
import { anchorInside } from '@houseit/geometry/anchor'
import { containsPoint } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'

type Record = Draft<HouseDocument>['rooms'][string]

export function rebindAll(draft: Draft<HouseDocument>): void {
  for (const level of Object.keys(draft.levels)) rebind(draft, level)
}

export function rebind(draft: Draft<HouseDocument>, level: string): void {
  const loose = Object.values(draft.rooms).filter((room) => room.level === level)
  if (loose.length === 0) return

  const faces = findFaces(draft, level)
  const free = new Set(faces.keys())

  const claim = (room: Record, nth: number) => {
    free.delete(nth)
    bind(draft, room, faces[nth]!)
  }

  const stillLoose = pass(loose, (room) =>
    [...free].find((nth) => same(room.loop, faces[nth]!.walls)),
  )
  const andStill = pass(stillLoose, (room) =>
    [...free].find((nth) => containsPoint(polygonOf(draft, faces[nth]!), room.x, room.y)),
  )
  const orphans = pass(andStill, (room) => closest(room, faces, free))

  for (const room of orphans) room.loop = []

  function pass(rooms: Record[], pick: (room: Record) => number | undefined): Record[] {
    const missed: Record[] = []
    for (const room of rooms) {
      const nth = pick(room)
      if (nth === undefined) missed.push(room)
      else claim(room, nth)
    }
    return missed
  }
}

function closest(room: Record, faces: Face[], free: Set<number>): number | undefined {
  const known = new Set(room.loop)
  if (known.size === 0) return undefined
  let best: number | undefined
  let most = 0
  for (const nth of free) {
    const shared = faces[nth]!.walls.filter((wall) => known.has(wall)).length
    if (shared > most) {
      most = shared
      best = nth
    }
  }
  return best
}

const same = (loop: readonly string[], walls: readonly string[]) =>
  loop.length === walls.length && new Set(walls).size === new Set([...loop, ...walls]).size

function bind(draft: Draft<HouseDocument>, room: Record, face: Face): void {
  room.loop = [...face.walls]
  const anchor = anchorInside(polygonOf(draft, face), face.area)
  room.x = anchor.x
  room.y = anchor.y
}

const polygonOf = (draft: Draft<HouseDocument>, face: Face) =>
  face.nodes.map((id) => ({ x: draft.nodes[id]!.x, y: draft.nodes[id]!.y }))
