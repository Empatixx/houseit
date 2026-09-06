import type { HouseDocument } from '@houseit/core/document'
import type { ProjectsDb } from './db'
import { outlineOf } from './outline'

export const WRITE_DELAY = 250

export type Writer = {
  schedule(id: string, doc: HouseDocument, level: string): void
  flush(): Promise<void>
}

export function createWriter(db: Promise<ProjectsDb>): Writer {
  let waiting: { id: string; doc: HouseDocument; level: string } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
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
