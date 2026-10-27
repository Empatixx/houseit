import type { HouseDocument } from '@houseit/core/document'
import * as OBC from '@thatopen/components'
import { DataMap } from '@thatopen/fragments'
import { type CheckedThing, checkEntities, checkModel } from './ids-model'

export type NormCheck = {
  rule: string
  identifier?: string
  instructions?: string
  thing: CheckedThing
  pass: boolean
  found?: unknown
  required?: unknown
}

const MODEL = 'houseit-ids'
const MODELS = [new RegExp(`^${MODEL}$`)]

async function test(specification: OBC.IDSSpecification) {
  const each = await Promise.all(
    [...specification.applicability].map(async (facet) => {
      const found: OBC.ModelIdMap = {}
      await facet.getEntities(MODELS, found)
      return found
    }),
  )
  const applicable: OBC.ModelIdMap = {}
  for (const [model, ids] of Object.entries(each[0] ?? {})) {
    const kept = [...ids].filter((id) => each.every((found) => found[model]?.has(id)))
    if (kept.length) applicable[model] = new Set(kept)
  }
  const result: OBC.IDSCheckResult = new DataMap()
  for (const requirement of specification.requirements)
    await requirement.test(applicable, result, { skipIfFails: true })
  return result
}
const SOURCE = '/norms/cz-byty.ids'
const loaded = new WeakMap<OBC.Components, Promise<OBC.IDSSpecification[]>>()

function specificationsOf(components: OBC.Components) {
  let known = loaded.get(components)
  if (!known) {
    known = fetch(SOURCE)
      .then((response) => {
        if (!response.ok) throw new Error(`no norms at ${SOURCE}`)
        return response.text()
      })
      .then((xml) => components.get(OBC.IDSSpecifications).load(xml))
    loaded.set(components, known)
  }
  return known
}

export async function checkNorms(
  components: OBC.Components,
  doc: HouseDocument,
): Promise<NormCheck[]> {
  const specifications = await specificationsOf(components)
  const { buffer, owners } = checkModel(checkEntities(doc))
  const fragments = components.get(OBC.FragmentsManager)
  await fragments.core.load(buffer, { modelId: MODEL })
  try {
    const checks: NormCheck[] = []
    for (const specification of specifications) {
      const result = await test(specification)
      const items: Map<number, OBC.IDSItemCheckResult> = result.get(MODEL) ?? new Map()
      for (const [localId, item] of items) {
        const thing = owners.get(localId)
        if (!thing) continue
        const failed = item.checks.flatMap((facet) => facet.checks).find((check) => !check.pass)
        checks.push({
          rule: specification.name,
          ...(specification.identifier ? { identifier: specification.identifier } : {}),
          ...(specification.instructions ? { instructions: specification.instructions } : {}),
          thing,
          pass: item.pass,
          ...(failed ? { found: failed.currentValue, required: failed.requiredValue } : {}),
        })
      }
    }
    return checks
  } finally {
    await fragments.core.disposeModel(MODEL)
  }
}
