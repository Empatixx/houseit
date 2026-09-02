import type { HouseDocument } from '@houseit/core/document'

/** What the agent sees of a room: enough to reason about, not the raw face. */
export type RoomSummary = { name?: string; area: number }

export type PlanSnapshot = { document: HouseDocument; rooms: RoomSummary[] }

/**
 * What a command that only looks has to say: `describe` and `measure` answer
 * with plain data, one entry per such line of the script, in order. A script of
 * nothing but changes answers with none.
 */
export type Output = Record<string, unknown>

export type ExecResult =
  | ({ ok: true; output: Output[] } & PlanSnapshot)
  | { ok: false; error: string }

/**
 * What to put in front of the camera: a room, a thing in it, or the whole
 * level, picked out the way a click would pick it — so the picture taken next
 * shows what a person would see having asked the same question.
 */
export type ViewRequest = {
  /** A room by name. Left out, the whole level. */
  room?: string
  /** With a room: the last thing of this type put there, picked so its clearances show. */
  type?: string
  /** Without a room: every room's dimensions at once. */
  dimensions?: boolean
}

export type ShowResult = { ok: true } | { ok: false; error: string }

/**
 * The contract between the editor tab and whatever drives it. The editor installs
 * an implementation on `window.floorplan`; the MCP server and the CLI call it
 * through CDP. Kept in its own package so neither side depends on the other —
 * nothing may depend on an application.
 */
export type FloorplanBridge = {
  /** Runs a command script. Never throws: failure comes back as `{ ok: false }`. */
  exec: (source: string) => ExecResult
  getPlan: () => PlanSnapshot
  help: () => string
  /** Frames and picks what is asked for, so a screenshot taken after shows it. */
  show: (view: ViewRequest) => ShowResult
}
