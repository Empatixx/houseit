import type { HouseDocument } from '@houseit/core/document'
import { migrateDocument } from '@houseit/core/migrate'

export type ProjectCodec = {
  encode(id: string, doc: HouseDocument): Promise<unknown>
  decode(id: string, stored: unknown): Promise<HouseDocument | undefined>
  close(): Promise<void>
}

export const documentCodec: ProjectCodec = {
  encode: async (_id, doc) => doc,
  decode: async (_id, stored) => {
    try {
      return migrateDocument(stored)
    } catch {
      return undefined
    }
  },
  close: async () => {},
}

export function fragmentCodec(): ProjectCodec {
  let current:
    | { id: string; project: import('../../engine/fragment-project').FragmentProject }
    | undefined
  let running: Promise<unknown> = Promise.resolve()
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = running.catch(() => {}).then(run)
    running = next
    return next
  }
  const close = async () => {
    const old = current
    current = undefined
    if (old) await old.project.dispose()
  }
  const get = async (id: string) => {
    if (current?.id !== id) {
      await close()
      const { FragmentProject } = await import('../../engine/fragment-project')
      current = { id, project: new FragmentProject() }
    }
    return current!.project
  }
  return {
    encode: (id, doc) =>
      serial(async () => {
        try {
          return await (await get(id)).save(doc)
        } catch (error) {
          await close()
          throw error
        }
      }),
    decode: (id, stored) =>
      serial(async () => {
        await close()
        if (
          typeof stored === 'object' &&
          stored !== null &&
          'format' in stored &&
          stored.format === 'houseit-fragments'
        ) {
          if (
            !('version' in stored) ||
            stored.version !== 1 ||
            !('buffer' in stored) ||
            !(stored.buffer instanceof ArrayBuffer || stored.buffer instanceof Uint8Array)
          )
            throw new Error('Invalid Houseit Fragment archive')
          try {
            const buffer = new Uint8Array(stored.buffer).slice().buffer
            return await (await get(id)).load(buffer)
          } catch (error) {
            await close()
            throw error
          }
        }
        return documentCodec.decode(id, stored)
      }),
    close: () => serial(close),
  }
}
