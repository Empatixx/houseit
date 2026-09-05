import type { Answer } from '@houseit/commands/answer'
import type { HouseDocument } from '@houseit/core/document'

/** What the agent sees of a room: enough to reason about, not the raw face. */
export type RoomSummary = { name?: string; area: number }

/** Which project the plan belongs to. Absent when none is open. */
export type ProjectSummary = { id: string; name: string }

export type PlanSnapshot = {
  document: HouseDocument
  rooms: RoomSummary[]
  project?: ProjectSummary
}

/**
 * What running a script gives back: the answer — what it touched, those rooms in
 * full, and what is now wrong with the plan — and the plan itself behind it.
 *
 * There is one shape, whether the script changed anything or only asked. That is
 * the point of there being no reading commands: a caller has one reply to learn,
 * and there is no second assembly of the same facts to drift away from this one.
 */
export type ExecResult =
  | ({ ok: true; answer: Answer } & PlanSnapshot)
  | { ok: false; error: string }

/**
 * What to put in front of the camera: a room, a thing in it, or the whole
 * level, picked out the way a click would pick it — so the picture taken next
 * shows what the command just did.
 */
export type ViewRequest = {
  /** A room by name or id. Left out, the whole level. */
  room?: string
  /** With a room: a thing in it by id, picked so its clearances show. */
  object?: string
  /** Without a room: every room's dimensions at once. */
  dimensions?: boolean
}

/** A part of the canvas, in CSS pixels from its top left corner. */
export type Clear = { x: number; y: number; width: number; height: number }

/** Whether what was asked for could be framed at all. */
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
  /**
   * Writes the plan back now rather than a quarter second after it stopped
   * changing. What a driver calls before closing a browser it opened itself.
   */
  save: () => Promise<void>
  /**
   * The project of that name or id, made if there is none. Says where it is;
   * going there is the driver's job, as clicking the card is a person's.
   *
   * Not a command, and on purpose: which plan is being worked on is not part of
   * any plan. A person picks it off the home screen and an agent is told, the
   * same way neither of them picks it with `add-room`.
   */
  ensureProject: (name: string) => Promise<ProjectSummary>
  /** Frames and picks what is asked for, so a screenshot taken after shows it. */
  show: (view: ViewRequest) => ShowResult
  /**
   * The part of the canvas nothing floats over, as it stands right now.
   *
   * Asked for separately from `show`, and after it, because `show` folds the
   * panel away and the folding is a render that has not happened yet when
   * `show` returns. Read in the same breath, the answer describes the screen
   * as it was rather than as it is about to be — which is a picture of a
   * sliver of plan down the side of a panel that is no longer there.
   */
  clear: () => Clear
}
