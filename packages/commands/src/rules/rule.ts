import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { objectType } from '@houseit/core/object-types'
import type { Room } from '@houseit/geometry/rooms'
import type { OpeningReport, RoomReport } from '../survey'

/**
 * What a rule is, and what every rule is given.
 *
 * One rule to a file, all of them the same shape, so that adding one is adding
 * a file rather than a branch in the middle of something else. What differs
 * between them is only what they look at: some read the storey as the plan
 * reports it, some want the rooms as geometry, and the ones about stairs want
 * the storeys either side of this one.
 *
 * The storey is read once, here, and handed round. Read again inside each rule
 * it would be eight walks of the wall graph to answer one question.
 */

export type Problem = {
  /** What kind of trouble, as a stable word for scripts: `room.unreachable`. */
  code: string
  /** An error makes the plan wrong; a warning makes it worse. */
  severity: 'error' | 'warning'
  room?: string
  message: string
}

/** One storey, read once: everything any rule needs to say what is wrong with it. */
export type Storey = {
  doc: HouseDocument
  level: string
  /** The rooms as the plan reports them — names, openings, what stands in each. */
  reports: RoomReport[]
  /** The same rooms as geometry, for anything that needs an outline to test against. */
  rooms: Room[]
}

/** One thing that can be wrong with a plan, and everything of that kind that is. */
export type Rule = (storey: Storey) => Problem[]

/** The doors of a room, which are the openings anybody walks through. */
export const doorsOf = (room: RoomReport): OpeningReport[] =>
  room.openings.filter((opening) => opening.kind === 'door')

/** A thing by the name a person would call it, for putting in a message. */
export const label = (object: HouseObject): string =>
  objectType(object.type)?.label.toLowerCase() ?? object.type
