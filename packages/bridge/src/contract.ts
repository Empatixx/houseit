import type { HouseDocument } from '@houseit/core/document'

/** What the agent sees of a room: enough to reason about, not the raw face. */
export type RoomSummary = { name?: string; area: number }

export type PlanSnapshot = { document: HouseDocument; rooms: RoomSummary[] }

export type ExecResult = ({ ok: true } & PlanSnapshot) | { ok: false; error: string }

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
}
