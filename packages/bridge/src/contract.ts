import type { Answer } from '@houseit/commands/answer'
import type { HouseDocument } from '@houseit/core/document'

export type RoomSummary = { name?: string; area: number }

export type ProjectSummary = { id: string; name: string }

export type PlanSnapshot = {
  document: HouseDocument
  rooms: RoomSummary[]
  project?: ProjectSummary
}

export type ExecResult =
  | ({ ok: true; answer: Answer } & PlanSnapshot)
  | { ok: false; error: string }

export type ViewRequest = {
  view?: 'plan' | 'overview' | 'north' | 'south' | 'east' | 'west' | 'roof'
  room?: string
  object?: string
  dimensions?: boolean
  site?: boolean
}

export type Clear = { x: number; y: number; width: number; height: number }

export type ShowResult = { ok: true } | { ok: false; error: string }

export type FloorplanBridge = {
  exec: (source: string) => ExecResult
  getPlan: () => PlanSnapshot
  help: () => string
  save: () => Promise<void>
  ensureProject: (name: string) => Promise<ProjectSummary>
  show: (view: ViewRequest) => ShowResult
  clear: () => Clear
}
