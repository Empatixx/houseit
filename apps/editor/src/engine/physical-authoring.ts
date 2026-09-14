import type { HouseDocument } from '@houseit/core/document'
import { geometryEntityKey, openingCategory } from '@houseit/core/entity-key'
import { isStaircase } from '@houseit/core/stairs'
import type { AuthoringEntity } from './nested-authoring'

export function extractPhysical(doc: HouseDocument, entities: Map<string, AuthoringEntity>) {
  const add = (owner: string, category: string) => {
    const key = geometryEntityKey(category, owner)
    entities.set(key, { category, parameters: { derived: true }, links: { PartOf: [owner] } })
    const parent = entities.get(owner)!
    parent.links.HasGeometry ??= []
    parent.links.HasGeometry.push(key)
  }
  for (const collection of ['rooms', 'levels'] as const)
    for (const id of Object.keys(doc[collection])) {
      add(`${collection}:${id}`, 'IFCCOVERING')
      add(`${collection}:${id}`, 'IFCSLAB')
    }
  for (const id of Object.keys(doc.walls)) add(`walls:${id}`, 'IFCCOVERING')
  for (const opening of Object.values(doc.openings))
    add(`openings:${opening.id}`, openingCategory(opening.kind))
  for (const object of Object.values(doc.objects))
    if (isStaircase(object.type)) add(`objects:${object.id}`, 'IFCSTAIR')
}
