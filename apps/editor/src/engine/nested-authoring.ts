import type { HouseDocument } from '@houseit/core/document'
import { nestedEntityKey } from '@houseit/core/entity-key'
import type { Roof } from '@houseit/core/roof'
import { produce } from 'immer'

export type AuthoringEntity = {
  category: string
  parameters: Record<string, unknown>
  links: Record<string, string[]>
  collections?: string[]
}

const levelParts = {
  columns: 'IFCCOLUMN',
  roofs: 'IFCROOF',
  ramps: 'IFCRAMP',
  shafts: 'IFCBUILDINGELEMENTPROXY',
  stairs: 'IFCSTAIR',
} as const
const siteParts = {
  surfaces: 'IFCGEOGRAPHICELEMENT',
  markings: 'IFCSURFACEFEATURE',
  railings: 'IFCRAILING',
} as const

export const orderedRelation = (name: string) => name.startsWith('HasParts:')
const relation = (collection: string) => `HasParts:${collection}`

export function normalizeAuthoringDocument(doc: HouseDocument, previous?: HouseDocument) {
  return produce(doc, (draft) => {
    for (const level of Object.values(draft.levels)) {
      const roofs = level.roofs ?? []
      const used = new Set<string>()
      for (const roof of roofs) {
        if (!roof.id) continue
        if (used.has(roof.id)) throw new Error(`Duplicate roof id ${roof.id} on ${level.id}`)
        used.add(roof.id)
      }
      const old = previous?.levels[level.id]?.roofs ?? []
      const reserved = new Set([...used, ...old.flatMap((roof) => (roof.id ? [roof.id] : []))])
      let next = 1
      const withoutId = ({ id: _, ...roof }: Roof) => JSON.stringify(roof)
      for (const roof of roofs) {
        if (roof.id) continue
        const available = old.filter((candidate) => candidate.id && !used.has(candidate.id))
        const exact = available.filter((candidate) => withoutId(candidate) === withoutId(roof))
        const named = available.filter((candidate) => candidate.name === roof.name)
        const uniqueName = roofs.filter((candidate) => candidate.name === roof.name).length === 1
        const match =
          exact.length === 1 ? exact[0] : uniqueName && named.length === 1 ? named[0] : undefined
        if (match) roof.id = match.id!
        else {
          while (reserved.has(`roof${next}`)) next++
          roof.id = `roof${next++}`
          reserved.add(roof.id)
        }
        used.add(roof.id)
      }
    }
  })
}

export function extractNested(doc: HouseDocument, entities: Map<string, AuthoringEntity>) {
  const addParts = (
    parent: string,
    source: Record<string, unknown>,
    categories: Record<string, string>,
  ) => {
    const host = entities.get(parent)!
    host.collections = []
    for (const [collection, category] of Object.entries(categories)) {
      const records = source[collection] as Record<string, unknown>[] | undefined
      delete host.parameters[collection]
      if (!records) continue
      host.collections.push(collection)
      host.links[relation(collection)] = records.map((record) => {
        if (typeof record.id !== 'string') throw new Error(`Missing ${collection} identity`)
        const key = nestedEntityKey(collection, parent, record.id)
        if (entities.has(key)) throw new Error(`Duplicate Fragment authoring key ${key}`)
        const entity: AuthoringEntity = {
          category,
          parameters: { ...record },
          links: { ContainedIn: [parent] },
        }
        if (typeof record.to === 'string') {
          entity.links.ConnectsTo = [`levels:${record.to}`]
          delete entity.parameters.to
        }
        if (collection === 'markings') {
          entity.links.MappedTo = [nestedEntityKey('surfaces', parent, String(record.surface))]
          delete entity.parameters.surface
        }
        entities.set(key, entity)
        return key
      })
    }
  }
  for (const level of Object.values(doc.levels)) addParts(`levels:${level.id}`, level, levelParts)
  const project = entities.get('project')!
  delete project.parameters.site
  project.links.ContainsTerrain = ['terrain']
  entities.set('terrain', {
    category: 'IFCSITE',
    parameters: { ...doc.site },
    links: { ContainedIn: ['project'] },
  })
  addParts('terrain', doc.site ?? {}, siteParts)
}

export function restoreNested(
  entities: Map<string, AuthoringEntity>,
  parent: string,
  record: Record<string, unknown>,
) {
  const entity = entities.get(parent)!
  const categories = parent === 'terrain' ? siteParts : levelParts
  for (const collection of entity.collections ?? []) {
    if (!(collection in categories)) throw new Error(`Invalid Fragment collection ${collection}`)
    if (record[collection] !== undefined) throw new Error(`Duplicated nested parameters ${parent}`)
    record[collection] = (entity.links[relation(collection)] ?? []).map((key) => {
      const child = entities.get(key)!
      const result = { ...child.parameters }
      if (child.links.ConnectsTo) {
        const [target] = child.links.ConnectsTo
        if (child.links.ConnectsTo.length !== 1 || !target?.startsWith('levels:'))
          throw new Error(`Invalid Fragment destination ${key}`)
        result.to = target.slice('levels:'.length)
      }
      if (collection === 'markings') {
        const targets = child.links.MappedTo ?? []
        if (targets.length !== 1) throw new Error(`Invalid Fragment surface ${key}`)
        result.surface = entities.get(targets[0]!)!.parameters.id
      }
      return result
    })
  }
}
