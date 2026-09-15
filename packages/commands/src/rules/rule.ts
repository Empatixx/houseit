import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { objectType } from '@houseit/core/object-types'
import type { Room } from '@houseit/geometry/rooms'
import type { OpeningReport, RoomReport } from '../survey'

export type Problem = {
  code: string
  severity: 'error' | 'warning'
  room?: string
  message: string
}

export type Storey = {
  doc: HouseDocument
  level: string
  reports: RoomReport[]
  rooms: Room[]
}

export type Rule = (storey: Storey) => Problem[]

export const doorsOf = (room: RoomReport): OpeningReport[] =>
  room.openings.filter(
    (opening) => opening.kind === 'door' || opening.panels?.some((p) => p.kind === 'door'),
  )

export const label = (object: HouseObject): string =>
  objectType(object.type)?.label.toLowerCase() ?? object.type
