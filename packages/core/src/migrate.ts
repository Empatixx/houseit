import { DOCUMENT_VERSION, type HouseDocument, parseDocument } from './document'
import { loopsFor } from './loops'

export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>

const MIGRATIONS: Record<number, Migration> = {
  1: ({ roomLabels, ...doc }) => ({ ...doc, rooms: roomLabels ?? {} }),
  2: (doc) => ({
    ...doc,
    objects: Object.fromEntries(
      Object.entries((doc.objects ?? {}) as Record<string, Record<string, unknown>>).map(
        ([id, { turn, ...object }]) => [
          id,
          { ...object, ...(turn === undefined ? {} : { rotation: turn }) },
        ],
      ),
    ),
  }),
  3: (doc) => {
    const levels = Object.keys((doc.levels ?? {}) as Record<string, unknown>)
    const rooms = (doc.rooms ?? {}) as Record<string, Record<string, unknown>>
    const found = new Map<string, string[]>()
    for (const level of levels) {
      for (const [id, loop] of loopsFor(doc as unknown as HouseDocument, level)) found.set(id, loop)
    }
    return {
      ...doc,
      rooms: Object.fromEntries(
        Object.entries(rooms).map(([id, room]) => [id, { ...room, loop: found.get(id) ?? [] }]),
      ),
    }
  },
}

function readVersion(input: unknown): number {
  if (typeof input !== 'object' || input === null || !('version' in input)) {
    throw new MigrationError('document has no version field')
  }
  const version = (input as { version: unknown }).version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MigrationError(`document has an unusable version: ${String(version)}`)
  }
  return version
}

export function migrateDocument(input: unknown): HouseDocument {
  let version = readVersion(input)
  if (version > DOCUMENT_VERSION) {
    throw new MigrationError(
      `document version ${version} is newer than this build understands (${DOCUMENT_VERSION})`,
    )
  }

  let doc = input as Record<string, unknown>
  while (version < DOCUMENT_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) {
      throw new MigrationError(`no migration from document version ${version}`)
    }
    doc = step(doc)
    version += 1
    doc = { ...doc, version }
  }

  return parseDocument(doc)
}
