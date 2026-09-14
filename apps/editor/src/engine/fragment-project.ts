import {
  EditRequestType as Edit,
  type EditRequest,
  EditUtils,
  GeomsFbUtils,
  type RawRelationData,
} from '@thatopen/fragments'
import { Color } from 'three'
import { type ArchiveAssetLoader, loadArchiveAsset } from './archive-resources'
import { type ArchivePaint, archiveScene, type GenerateGeometry } from './archive-scene'
import { nativeItems, nativeKey } from './authoring-graph'
import type { FragmentSnapshot } from './fragment-authoring'

export type FragmentArchive = { format: 'houseit-fragments'; version: 1; buffer: ArrayBuffer }

export async function writeFragment(
  snapshot: FragmentSnapshot,
  generate?: GenerateGeometry,
  loadAsset: ArchiveAssetLoader = loadArchiveAsset,
): Promise<FragmentArchive> {
  const session = generate ? undefined : (await import('./geometry-session')).acquireGeometry()
  try {
    return await encode(
      snapshot,
      generate ?? ((input) => session!.engine.geometry(input)),
      loadAsset,
    )
  } finally {
    session?.release()
  }
}

async function encode(
  snapshot: FragmentSnapshot,
  generate: GenerateGeometry,
  loadAsset: ArchiveAssetLoader,
): Promise<FragmentArchive> {
  const base = EditUtils.getModelFromBuffer(snapshot.base, true)
  const items = nativeItems(base)
  const relations = new Map<number, RawRelationData>()
  for (let i = 0; i < base.relationsLength(); i++)
    relations.set(base.relationsItems(i)!, EditUtils.getRelationData(base.relations(i)!))
  EditUtils.applyChangesToRawData(snapshot.requests, items, 'ITEM')
  EditUtils.applyChangesToRawData(snapshot.requests, relations, 'RELATION')
  const ids = new Map([...items].map(([id, item]) => [nativeKey(item), id]))
  const requests: EditRequest[] = [
    ...[...items].map(([localId, data]) => ({ type: Edit.CREATE_ITEM as const, localId, data })),
    ...[...relations].map(([localId, data]) => ({
      type: Edit.CREATE_RELATION as const,
      localId,
      data,
    })),
  ]
  let next = snapshot.nextId
  const localTransform = next++
  const identity = { position: [0, 0, 0], xDirection: [1, 0, 0], yDirection: [0, 1, 0] }
  requests.push({ type: Edit.CREATE_LOCAL_TRANSFORM, localId: localTransform, data: identity })
  const parts: { id: string; entity: string; item: number; samples: number[] }[] = []
  const appearance: {
    materials: Record<number, ArchivePaint>
    representations: Record<number, Record<string, unknown>>
  } = { materials: {}, representations: {} }
  const assets: Record<string, string> = {}
  const materials = new Map<string, number>()
  const representations = new Map<string, number>()
  for await (const part of archiveScene(snapshot.doc, generate)) {
    try {
      if (
        !part.geometry.getAttribute('position').count ||
        part.paints.every((paint) => paint.opacity === 0)
      )
        continue
      const itemId = ids.get(part.entity)
      if (itemId === undefined) throw new Error(`Fragment geometry owner ${part.entity} is missing`)
      const manifest = { id: part.id, entity: part.entity, item: itemId, samples: [] as number[] }
      parts.push(manifest)
      const globalTransform = next++
      const e = part.transform.elements
      requests.push({
        type: Edit.CREATE_GLOBAL_TRANSFORM,
        localId: globalTransform,
        data: {
          itemId,
          position: [e[12]!, e[13]!, e[14]!],
          xDirection: [e[0]!, e[1]!, e[2]!],
          yDirection: [e[4]!, e[5]!, e[6]!],
        },
      })
      const groups =
        part.paints.length > 1 &&
        new Set(part.paints.map((paint) => JSON.stringify(paint))).size > 1
          ? part.geometry.groups
          : [
              {
                start: 0,
                count: part.geometry.index?.count ?? part.geometry.getAttribute('position').count,
                materialIndex: 0,
              },
            ]
      for (const group of groups) {
        if (!group.count) continue
        const paint = part.paints[group.materialIndex ?? 0] ?? part.paints[0]!
        if (paint.opacity === 0) continue
        const materialKey = JSON.stringify(paint)
        let material = materials.get(materialKey)
        if (material === undefined) {
          material = next++
          materials.set(materialKey, material)
          appearance.materials[material] = paint
          for (const path of [
            paint.texture
              ? paint.texture.startsWith('/') ||
                paint.texture.startsWith('data:') ||
                paint.texture === 'houseit:ground'
                ? paint.texture
                : `/textures/${paint.texture}`
              : undefined,
            paint.symbol ? `/symbols/${paint.symbol}` : undefined,
          ]) {
            if (path && !assets[path]) assets[path] = await loadAsset(path)
          }
          requests.push({ type: Edit.CREATE_MATERIAL, localId: material, data: nativePaint(paint) })
        }
        const key = `${part.geometryKey}:${group.start}:${group.count}`
        let representation = representations.get(key)
        if (representation === undefined) {
          representation = next++
          representations.set(key, representation)
          const geometry = part.geometry.clone()
          try {
            const index = geometry.index
              ? Array.from(geometry.index.array)
              : Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i)
            geometry.setIndex(index.slice(group.start, group.start + group.count))
            appearance.representations[representation] = {
              attributes: Object.fromEntries(
                Object.entries(geometry.attributes).map(([name, attribute]) => [
                  name,
                  { itemSize: attribute.itemSize, array: Array.from(attribute.array) },
                ]),
              ),
              index: Array.from(geometry.index!.array),
            }
            requests.push({
              type: Edit.CREATE_REPRESENTATION,
              localId: representation,
              data: GeomsFbUtils.representationFromGeometry(geometry, undefined, {
                threshold: 0,
                precision: 1e6,
                normalPrecision: 1e7,
                planePrecision: 1e3,
                faceThreshold: 0.6,
                forceTransparentSpaces: false,
              }),
            })
          } finally {
            geometry.dispose()
          }
        }
        const sample = next++
        manifest.samples.push(sample)
        requests.push({
          type: Edit.CREATE_SAMPLE,
          localId: sample,
          data: { item: globalTransform, representation, material, localTransform },
        })
      }
    } finally {
      part.geometry.dispose()
    }
  }
  requests.push({
    type: Edit.UPDATE_METADATA,
    localId: 0,
    data: { houseit: { schema: 3, geometry: { version: 1, parts }, appearance, assets } },
  })
  requests.push({ type: Edit.UPDATE_MAX_LOCAL_ID, localId: next })
  const empty = EditUtils.getModelFromBuffer(EditUtils.newModel({ raw: true }), true)
  const archive = EditUtils.edit(empty, requests, { raw: false, delta: false }).model
  return { format: 'houseit-fragments', version: 1, buffer: new Uint8Array(archive).slice().buffer }
}

function nativePaint(paint: ArchivePaint) {
  const colour = new Color(paint.nativeColour ?? paint.colour).convertLinearToSRGB()
  return {
    r: colour.r * 255,
    g: colour.g * 255,
    b: colour.b * 255,
    a: (paint.opacity ?? 1) * 255,
    renderedFaces: paint.doubleSided ? 1 : 0,
    stroke: 0,
  }
}
