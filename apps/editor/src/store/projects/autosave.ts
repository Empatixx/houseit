import type { HouseDocument } from '@houseit/core/document'
import type { ProjectsDb } from './db'
import { outlineOf } from './outline'

/**
 * How long the plan is left alone before it is written back. A drag is a
 * hundred edits and one plan; this is what makes it one write.
 */
export const WRITE_DELAY = 250

export type Writer = {
  /** Says the plan has changed. The write follows once it stops changing. */
  schedule(id: string, doc: HouseDocument, level: string): void
  /** Writes whatever is waiting, now. Awaited before a project is left. */
  flush(): Promise<void>
}

/**
 * Writing the open project's plan back as it is edited.
 *
 * IndexedDB is asynchronous where the single localStorage key it replaces was
 * not, so an edit per frame of a drag would queue a transaction per frame. The
 * plan is held instead until it stops moving, and only the last of them is
 * written.
 *
 * What is held is the project's id and not its record: the record on disk may
 * have been renamed in between, and the plan being saved is no reason to undo
 * that. It is read again at the moment of writing.
 */
export function createWriter(db: Promise<ProjectsDb>): Writer {
  let waiting: { id: string; doc: HouseDocument; level: string } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  /** The write already under way, so a flush waits for it as well as for its own. */
  let running: Promise<void> = Promise.resolve()

  const write = async (): Promise<void> => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    const pending = waiting
    waiting = undefined
    if (!pending) return

    const database = await db
    await database.write(pending.id, pending.doc)
    const meta = await database.meta(pending.id)
    if (!meta) return
    await database.put({
      ...meta,
      updatedAt: Date.now(),
      outline: outlineOf(pending.doc, pending.level),
    })
  }

  return {
    schedule(id, doc, level) {
      waiting = { id, doc, level }
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        running = write()
      }, WRITE_DELAY)
    },
    flush: async () => {
      const under = running
      const now = write()
      await under
      await now
    },
  }
}
