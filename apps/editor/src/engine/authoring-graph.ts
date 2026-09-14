import { type HouseDocument, parseDocument } from '@houseit/core/document'
import { findFaces } from '@houseit/core/faces'
import { elementId } from '@houseit/geometry/wall-elements'
import {
  EditRequestType as Edit,
  type EditRequest,
  EditUtils,
  type RawItemData,
  type RawRelationData,
} from '@thatopen/fragments'
import {
  type AuthoringEntity as Entity,
  extractNested,
  orderedRelation,
  restoreNested,
} from './nested-authoring'
import { extractPhysical } from './physical-authoring'

export type NativeGraph = {
  items: Map<number, RawItemData>
  relations: Map<number, RawRelationData>
}

export function nativeItems(base: ReturnType<typeof EditUtils.getModelFromBuffer>) {
  const items = EditUtils.getItems(base)
  for (const item of items.values()) {
    delete item.guid
    for (const attribute of Object.values(item.data))
      if (attribute.type == null) delete attribute.type
  }
  for (let i = 0; i < base.guidsItemsLength(); i++) {
    const item = items.get(base.guidsItems(i)!)
    if (item) item.guid = base.guids(i)!
  }
  return items
}

const categories = {
  levels: 'IFCBUILDINGSTOREY',
  nodes: 'HOUSEITJUNCTION',
  walls: 'HOUSEITWALLSEGMENT',
  rooms: 'IFCSPACE',
  openings: 'IFCOPENINGELEMENT',
  objects: 'IFCFURNISHINGELEMENT',
  devices: 'IFCDISTRIBUTIONELEMENT',
  circuits: 'IFCDISTRIBUTIONSYSTEM',
} as const

type Collection = keyof typeof categories
const keyOf = (collection: string, id: string) => `${collection}:${id}`
export const nativeKey = (item: RawItemData) => item.data.HouseitKey?.value as string | undefined
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function entitiesOf(doc: HouseDocument, nested = true, physical = true): Map<string, Entity> {
  const entities = new Map<string, Entity>()
  entities.set('project', {
    category: 'IFCPROJECT',
    parameters: { version: doc.version, ...(doc.site ? { site: doc.site } : {}) },
    links: { Contains: Object.keys(doc.levels).map((id) => keyOf('levels', id)) },
  })
  for (const collection of Object.keys(categories) as Collection[]) {
    for (const record of Object.values(doc[collection])) {
      entities.set(keyOf(collection, record.id), {
        category: categories[collection],
        parameters: { ...record },
        links: {},
      })
    }
  }
  const link = (key: string, name: string, targets: string[], field?: string) => {
    const entity = entities.get(key)!
    entity.links[name] = targets
    if (field) delete entity.parameters[field]
  }
  for (const wall of Object.values(doc.walls)) {
    const key = keyOf('elements', elementId(wall))
    if (!entities.has(key))
      entities.set(key, {
        category: 'IFCWALL',
        parameters: { id: elementId(wall) },
        links: { HasSegments: [], HasOpenings: [] },
      })
    entities.get(key)!.links.HasSegments!.push(keyOf('walls', wall.id))
    const segment = keyOf('walls', wall.id)
    link(segment, 'PartOf', [key])
    link(segment, 'Start', [keyOf('nodes', wall.a)], 'a')
    link(segment, 'End', [keyOf('nodes', wall.b)], 'b')
    for (const node of [wall.a, wall.b]) {
      const junction = entities.get(keyOf('nodes', node))!
      junction.links.ConnectedSegments ??= []
      junction.links.ConnectedSegments.push(segment)
    }
  }
  for (const collection of ['walls', 'rooms', 'objects'] as const) {
    for (const record of Object.values(doc[collection]))
      link(keyOf(collection, record.id), 'ContainedIn', [keyOf('levels', record.level)], 'level')
  }
  for (const room of Object.values(doc.rooms))
    link(
      keyOf('rooms', room.id),
      'BoundedBy',
      room.loop.map((id) => keyOf('walls', id)),
      'loop',
    )
  for (const level of Object.keys(doc.levels)) {
    for (const face of findFaces(doc, level)) {
      const boundary = [...face.walls].sort().join(',')
      const named = Object.values(doc.rooms).some(
        (room) => room.level === level && [...room.loop].sort().join(',') === boundary,
      )
      if (named) continue
      entities.set(`spaces:${level}:${boundary}`, {
        category: 'IFCSPACE',
        parameters: { derived: true, area: face.area },
        links: {
          ContainedIn: [keyOf('levels', level)],
          BoundedBy: face.walls.map((id) => keyOf('walls', id)),
        },
      })
    }
  }
  for (const opening of Object.values(doc.openings)) {
    const key = keyOf('openings', opening.id)
    const host = keyOf('elements', elementId(doc.walls[opening.wall]!))
    link(key, 'VoidsElement', [host])
    link(key, 'HostSegment', [keyOf('walls', opening.wall)], 'wall')
    entities.get(host)!.links.HasOpenings!.push(key)
  }
  for (const object of Object.values(doc.objects))
    link(keyOf('objects', object.id), 'InSpace', [keyOf('rooms', object.room)], 'room')
  for (const device of Object.values(doc.devices)) {
    const host =
      device.host.kind === 'wall'
        ? keyOf('walls', device.host.wall)
        : keyOf('levels', device.host.level)
    link(keyOf('devices', device.id), 'HostedBy', [host])
  }
  for (const circuit of Object.values(doc.circuits)) {
    const key = keyOf('circuits', circuit.id)
    link(key, 'SuppliedBy', [keyOf('devices', circuit.panel)], 'panel')
    link(
      key,
      'Supplies',
      circuit.devices.map((id) => keyOf('devices', id)),
      'devices',
    )
  }
  if (nested) extractNested(doc, entities)
  if (physical) extractPhysical(doc, entities)
  for (const entity of entities.values()) {
    for (const [name, targets] of Object.entries(entity.links)) {
      if (targets.length === 0) delete entity.links[name]
      else if (name !== 'BoundedBy' && name !== 'Supplies' && !orderedRelation(name)) targets.sort()
    }
  }
  return entities
}

export function graphRequests(
  doc: HouseDocument,
  graph: NativeGraph,
  nextId: number,
): EditRequest[] {
  const entities = entitiesOf(doc)
  const ids = new Map<string, number>()
  for (const [id, item] of graph.items) {
    const key = nativeKey(item)
    if (key) {
      if (ids.has(key)) throw new Error(`Duplicate Fragment authoring key ${key}`)
      ids.set(key, id)
    }
    nextId = Math.max(nextId, id + 1)
  }
  for (const key of entities.keys()) if (!ids.has(key)) ids.set(key, nextId++)
  const requests: EditRequest[] = []
  for (const [key, id] of ids) {
    const entity = entities.get(key)
    const previous = graph.items.get(id)
    const relations = graph.relations.get(id)
    if (!entity) {
      if (relations) requests.push({ type: Edit.DELETE_RELATION, localId: id })
      requests.push({ type: Edit.DELETE_ITEM, localId: id })
      continue
    }
    const data: RawItemData = {
      category: entity.category,
      ...(previous?.guid ? { guid: previous.guid } : {}),
      data: {
        Name: { value: String(entity.parameters.name ?? entity.parameters.id ?? 'Houseit') },
        HouseitKey: { value: key },
        Parameters: { value: JSON.stringify(entity.parameters) },
        ...(entity.collections
          ? { NestedCollections: { value: JSON.stringify(entity.collections) } }
          : {}),
        RelationCounts: {
          value: JSON.stringify(
            Object.fromEntries(
              Object.entries(entity.links).map(([name, targets]) => [name, targets.length]),
            ),
          ),
        },
      },
    }
    if (
      !previous ||
      previous.category !== data.category ||
      Object.keys(data.data).some(
        (name) => !same(previous.data[name]?.value, data.data[name]?.value),
      )
    )
      requests.push({ type: previous ? Edit.UPDATE_ITEM : Edit.CREATE_ITEM, localId: id, data })
    const linked: RawRelationData = { data: {} }
    for (const [name, targets] of Object.entries(entity.links))
      linked.data[name] = targets.map((target) => {
        const id = ids.get(target)
        if (id === undefined || !entities.has(target))
          throw new Error(`Missing Fragment relation target ${target}`)
        return id
      })
    if (!same(relations?.data ?? {}, linked.data))
      requests.push({
        type: relations ? Edit.UPDATE_RELATION : Edit.CREATE_RELATION,
        localId: id,
        data: linked,
      })
  }
  if (requests.length) requests.push({ type: Edit.UPDATE_MAX_LOCAL_ID, localId: nextId })
  return requests
}

export function documentFromGraph(
  graph: NativeGraph,
  nested = true,
  physical = true,
): HouseDocument {
  const entities = new Map<string, Entity>()
  const keys = new Map<number, string>()
  for (const [id, item] of graph.items) {
    const key = nativeKey(item)
    if (!key) continue
    if (entities.has(key)) throw new Error(`Duplicate Fragment authoring key ${key}`)
    const encoded = item.data.Parameters?.value
    if (typeof encoded !== 'string') throw new Error(`Fragment ${key} has no authoring parameters`)
    entities.set(key, {
      category: item.category,
      parameters: JSON.parse(encoded),
      links: {},
      ...(item.data.NestedCollections
        ? { collections: JSON.parse(String(item.data.NestedCollections.value)) }
        : {}),
    })
    keys.set(id, key)
  }
  for (const [id, key] of keys) {
    for (const [name, targets] of Object.entries(graph.relations.get(id)?.data ?? {})) {
      entities.get(key)!.links[name] = targets.map((target) => {
        const key = keys.get(target)
        if (!key) throw new Error(`Fragment relation ${name} has a missing target ${target}`)
        return key
      })
    }
  }
  for (const [id, key] of keys) {
    const encoded = graph.items.get(id)!.data.RelationCounts?.value
    if (typeof encoded !== 'string') continue
    const counts = JSON.parse(encoded) as Record<string, number>
    const links = entities.get(key)!.links
    if (
      Object.keys(counts).length !== Object.keys(links).length ||
      Object.entries(counts).some(([name, count]) => links[name]?.length !== count)
    )
      throw new Error(`Incomplete Fragment relationships for ${key}`)
  }
  const project = entities.get('project')
  if (!project) throw new Error('Fragment model has no Houseit project element')
  const doc: Record<string, unknown> = { ...project.parameters }
  const targets = (entity: Entity, name: string, collection: string): string[] => {
    const links = entity.links[name] ?? []
    return links.map((key) => {
      if (!key.startsWith(`${collection}:`))
        throw new Error(`Invalid Fragment relation ${name}: ${key}`)
      return key.slice(collection.length + 1)
    })
  }
  const single = (entity: Entity, name: string, collection: string) => {
    const ids = targets(entity, name, collection)
    if (ids.length !== 1) throw new Error(`Fragment relation ${name} must have one target`)
    return ids[0]!
  }
  for (const collection of Object.keys(categories) as Collection[]) {
    const records: Record<string, unknown> = {}
    doc[collection] = records
    for (const [key, entity] of entities) {
      if (!key.startsWith(`${collection}:`)) continue
      const record = { ...entity.parameters }
      if (nested && collection === 'levels') restoreNested(entities, key, record)
      if (collection === 'walls' || collection === 'rooms' || collection === 'objects')
        record.level = single(entity, 'ContainedIn', 'levels')
      if (collection === 'walls') {
        record.a = single(entity, 'Start', 'nodes')
        record.b = single(entity, 'End', 'nodes')
      }
      if (collection === 'rooms') record.loop = targets(entity, 'BoundedBy', 'walls')
      if (collection === 'openings') record.wall = single(entity, 'HostSegment', 'walls')
      if (collection === 'objects') record.room = single(entity, 'InSpace', 'rooms')
      if (collection === 'circuits') {
        record.panel = single(entity, 'SuppliedBy', 'devices')
        record.devices = targets(entity, 'Supplies', 'devices')
      }
      records[key.slice(collection.length + 1)] = record
    }
  }
  if (nested) {
    const terrain = entities.get('terrain')
    if (!terrain) throw new Error('Fragment model has no terrain element')
    if (terrain.collections?.length) {
      const site = { ...terrain.parameters }
      restoreNested(entities, 'terrain', site)
      doc.site = site
    }
  }
  const result = parseDocument(doc)
  const expected = entitiesOf(result, nested, physical)
  if (entities.size !== expected.size) throw new Error('Fragment authoring elements disagree')
  for (const [key, entity] of expected) {
    const actual = entities.get(key)
    if (
      !actual ||
      actual.category !== entity.category ||
      !same(actual.collections, entity.collections)
    )
      throw new Error(`Invalid Fragment element ${key}`)
    const names = Object.keys(entity.links)
    if (
      names.length !== Object.keys(actual.links).length ||
      names.some((name) => !same(entity.links[name], actual.links[name]))
    )
      throw new Error(`Inconsistent Fragment relationships for ${key}`)
  }
  return result
}
