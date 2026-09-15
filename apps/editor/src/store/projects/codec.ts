import type { HouseDocument } from '@houseit/core/document'
import { migrateDocument } from '@houseit/core/migrate'
import { type DocumentSource, FragmentAuthoring } from '../../engine/fragment-authoring'

export type ProjectCodec = {
  encode(id: string, doc: HouseDocument): Promise<unknown>
  decode(id: string, stored: unknown): Promise<DocumentSource | undefined>
  capture?(authoring: FragmentAuthoring): () => Promise<unknown>
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
}

export function fragmentCodec(): ProjectCodec {
  const capture = (authoring: FragmentAuthoring) => {
    const snapshot = authoring.snapshot()
    return async () => {
      const { writeFragment } = await import('../../engine/fragment-project')
      return writeFragment(snapshot)
    }
  }
  return {
    capture,
    encode: async (_id, doc) => {
      const authoring = new FragmentAuthoring(doc)
      try {
        return await capture(authoring)()
      } finally {
        authoring.dispose()
      }
    },
    decode: async (id, stored) => {
      if (
        typeof stored !== 'object' ||
        stored === null ||
        !('format' in stored) ||
        stored.format !== 'houseit-fragments'
      )
        return documentCodec.decode(id, stored)
      if (
        !('version' in stored) ||
        stored.version !== 1 ||
        !('buffer' in stored) ||
        !(stored.buffer instanceof ArrayBuffer || stored.buffer instanceof Uint8Array)
      )
        throw new Error('Invalid Houseit Fragment archive')
      return new Uint8Array(stored.buffer).slice()
    },
  }
}
