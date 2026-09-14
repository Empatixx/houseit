import type { SingleThreadedFragmentsModel } from '@thatopen/fragments'
import type { NativeGraph } from './authoring-graph'
import { nativeKey } from './authoring-graph'

export function validateArchiveGeometry(model: SingleThreadedFragmentsModel, graph: NativeGraph) {
  const metadata = model.getMetadata() as {
    houseit?: {
      geometry?: {
        version: number
        parts: { id: string; entity: string; item: number; samples: number[] }[]
      }
    }
  }
  const manifest = metadata.houseit?.geometry
  if (!manifest) return
  if (manifest.version !== 1 || !Array.isArray(manifest.parts))
    throw new Error('Unsupported Fragment geometry manifest')
  const samples = model.getSamples()
  const transforms = model.getGlobalTransforms()
  const representations = new Set(model.getRepresentationsIds())
  const materials = new Set(model.getMaterialsIds())
  const ids = new Set<string>(),
    used = new Set<number>()
  for (const part of manifest.parts) {
    if (
      typeof part.id !== 'string' ||
      ids.has(part.id) ||
      nativeKey(graph.items.get(part.item) ?? { category: '', data: {} }) !== part.entity
    )
      throw new Error(`Invalid Fragment geometry owner ${part.id}`)
    ids.add(part.id)
    if (!Array.isArray(part.samples) || part.samples.length === 0)
      throw new Error(`Missing Fragment geometry ${part.id}`)
    for (const id of part.samples) {
      const sample = samples.get(id)
      if (
        !sample ||
        used.has(id) ||
        transforms.get(sample.item)?.itemId !== part.item ||
        !representations.has(sample.representation) ||
        !materials.has(sample.material)
      )
        throw new Error(`Incomplete Fragment geometry ${part.id}`)
      used.add(id)
    }
  }
  if (used.size !== samples.size) throw new Error('Unclaimed Fragment geometry samples')
}
