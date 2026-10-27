import { surveyLevel } from '@houseit/commands/survey'
import type { HouseDocument } from '@houseit/core/document'
import { levelsOf, soffitOf } from '@houseit/core/levels'
import { roomKindOf } from '@houseit/core/room-kinds'
import { EditRequestType as Edit, type EditRequest, EditUtils } from '@thatopen/fragments'

export type CheckedThing = { kind: 'room' | 'opening'; id: string; name: string }

type Value = string | number | boolean
type Entity = {
  category: string
  name: string
  owner: CheckedThing
  set: string
  values: Record<string, Value>
}

export function checkEntities(doc: HouseDocument): Entity[] {
  const entities: Entity[] = []
  for (const storey of levelsOf(doc)) {
    const clear = soffitOf(storey)
    for (const room of surveyLevel(doc, storey.id).rooms) {
      if (!room.id) continue
      const kind = roomKindOf(room)
      const name = room.name ?? room.id
      entities.push({
        category: 'IFCSPACE',
        name,
        owner: { kind: 'room', id: room.id, name },
        set: 'Houseit_Space',
        values: {
          Kind: kind?.id ?? 'unknown',
          Habitable: Boolean(kind && kind.needsWindow && !kind.passage && !kind.outdoor),
          NetFloorArea: Math.round(room.areaM2 * 100) / 100,
          ClearHeight: Math.round(clear) / 1000,
          WindowCount: room.openings.filter((it) => it.kind === 'window').length,
        },
      })
      for (const opening of room.openings) {
        if (opening.kind !== 'door' || entities.some((it) => it.owner.id === opening.id)) continue
        entities.push({
          category: 'IFCDOOR',
          name: opening.id,
          owner: { kind: 'opening', id: opening.id, name: `${opening.id} (${name})` },
          set: 'Houseit_Door',
          values: { ClearWidth: opening.width },
        })
      }
    }
  }
  return entities
}

export function checkModel(entities: Entity[]): {
  buffer: Uint8Array
  owners: Map<number, CheckedThing>
} {
  const requests: EditRequest[] = []
  const owners = new Map<number, CheckedThing>()
  let next = 1
  for (const entity of entities) {
    const element = next++
    const set = next++
    owners.set(element, entity.owner)
    requests.push({
      type: Edit.CREATE_ITEM,
      localId: element,
      data: { category: entity.category, data: { Name: { value: entity.name } } },
    })
    const properties = Object.entries(entity.values).map(([name, value]) => {
      const id = next++
      requests.push({
        type: Edit.CREATE_ITEM,
        localId: id,
        data: {
          category: 'IFCPROPERTYSINGLEVALUE',
          data: { Name: { value: name }, NominalValue: { value } },
        },
      })
      return id
    })
    requests.push(
      {
        type: Edit.CREATE_ITEM,
        localId: set,
        data: { category: 'IFCPROPERTYSET', data: { Name: { value: entity.set } } },
      },
      { type: Edit.CREATE_RELATION, localId: element, data: { data: { IsDefinedBy: [set] } } },
      {
        type: Edit.CREATE_RELATION,
        localId: set,
        data: { data: { HasProperties: properties, DefinesOcurrence: [element] } },
      },
    )
  }
  const base = EditUtils.getModelFromBuffer(EditUtils.newModel({ raw: true }), true)
  const buffer = EditUtils.edit(base, requests, { raw: false, delta: false }).model
  return { buffer, owners }
}
