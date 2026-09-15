import type { HouseDocument } from '@houseit/core/document'
import type { ProjectsDb } from './db'
import { outlineOf } from './outline'

export const WRITE_DELAY = 250

export type SaveState =
  | { status: 'saved' | 'pending' | 'saving' }
  | { status: 'error'; message: string }

export type Writer = {
  schedule(id: string, doc: HouseDocument, level: string, encode?: () => Promise<unknown>): void
  flush(): Promise<void>
}

export function createWriter(
  db: () => Promise<ProjectsDb>,
  encode: (id: string, doc: HouseDocument) => Promise<unknown> = async (_id, doc) => doc,
  onState: (state: SaveState) => void = () => {},
): Writer {
  let sequence = 0
  let waiting:
    | {
        id: string
        doc: HouseDocument
        level: string
        sequence: number
        encode?: () => Promise<unknown>
      }
    | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> = Promise.resolve()
  let queued = 0

  const write = (): Promise<void> => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    const pending = waiting
    waiting = undefined
    if (!pending) return running
    queued++

    running = running
      .catch(() => {})
      .then(async () => {
        onState({ status: 'saving' })
        try {
          const encoded = await (pending.encode
            ? pending.encode()
            : encode(pending.id, pending.doc))
          const database = await db()
          await database.write(pending.id, encoded)
          const meta = await database.meta(pending.id)
          if (!meta) throw new Error('The project metadata is missing')
          await database.put({
            ...meta,
            updatedAt: Date.now(),
            outline: outlineOf(pending.doc, pending.level),
          })
        } catch (error) {
          if (pending.sequence === sequence) waiting ??= pending
          onState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
          throw error
        } finally {
          queued--
        }
        onState({ status: queued ? 'saving' : waiting ? 'pending' : 'saved' })
      })
    void running.catch(() => {})
    return running
  }

  return {
    schedule(id, doc, level, encode) {
      waiting = { id, doc, level, sequence: ++sequence, encode }
      onState({ status: queued ? 'saving' : 'pending' })
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        void write()
      }, WRITE_DELAY)
    },
    flush: async () => {
      do {
        await write()
      } while (waiting)
    },
  }
}
