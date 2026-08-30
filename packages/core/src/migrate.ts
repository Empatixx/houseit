import { DOCUMENT_VERSION, type HouseDocument, parseDocument } from './document'

/**
 * Raised when stored data cannot be brought up to the current schema. Distinct
 * from a schema error: the document may be perfectly valid, just not for us.
 */
export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}

/**
 * One step of the chain, taking the shape stored at `from` to the shape stored at
 * `from + 1`. Steps run on unvalidated data — the schema is only applied once the
 * document has reached the current version.
 */
type Migration = (doc: Record<string, unknown>) => Record<string, unknown>

/** Indexed by the version being migrated away from. Empty while v1 is current. */
const MIGRATIONS: Record<number, Migration> = {}

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

/**
 * Brings stored data up to the current schema, then validates it. Always use this
 * to load a document; `parseDocument` alone assumes the data is already current.
 */
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
