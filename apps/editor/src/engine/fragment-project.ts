import type { HouseDocument } from '@houseit/core/document'
import { elementId } from '@houseit/geometry/wall-elements'
import {
  EditRequestType as Edit,
  type EditRequest,
  EditUtils,
  GeomsFbUtils,
  type RawItemData,
  type RawRelationData,
} from '@thatopen/fragments'
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { nativeKey } from './authoring-graph'
import type { FragmentSnapshot } from './fragment-authoring'
import type { GeometryData } from './geometry-protocol'
import { type WallBody, wallBody } from './wall-body'

export type FragmentArchive = { format: 'houseit-fragments'; version: 1; buffer: ArrayBuffer }
type WallGeometry = (body: WallBody) => Promise<GeometryData>

export async function writeFragment(
  snapshot: FragmentSnapshot,
  generate?: WallGeometry,
): Promise<FragmentArchive> {
  const session = generate ? undefined : (await import('./geometry-session')).acquireGeometry()
  try {
    return await encode(snapshot, generate ?? ((body) => session!.engine.wall(body)))
  } finally {
    session?.release()
  }
}

async function encode(
  snapshot: FragmentSnapshot,
  generate: WallGeometry,
): Promise<FragmentArchive> {
  const base = EditUtils.getModelFromBuffer(snapshot.base, true)
  const items = EditUtils.getItems(base)
  EditUtils.applyChangesToRawData(snapshot.requests, items, 'ITEM')
  const ids = new Map([...items].map(([id, item]) => [nativeKey(item), id]))
  const requests = snapshotRequests(snapshot, base)
  for (const [type, ids] of [
    [Edit.DELETE_SAMPLE, EditUtils.getSamplesIds(base)],
    [Edit.DELETE_GLOBAL_TRANSFORM, EditUtils.getGlobalTransformsIds(base)],
    [Edit.DELETE_LOCAL_TRANSFORM, EditUtils.getLocalTransformsIds(base)],
    [Edit.DELETE_REPRESENTATION, EditUtils.getRepresentationsIds(base)],
    [Edit.DELETE_MATERIAL, EditUtils.getMaterialsIds(base)],
  ] as const)
    for (const localId of ids) requests.push({ type, localId })
  let next = snapshot.nextId
  const material = next++,
    localTransform = next++
  const identity = { position: [0, 0, 0], xDirection: [1, 0, 0], yDirection: [0, 1, 0] }
  const colour = new Color('#f1f0ed')
  requests.push(
    {
      type: Edit.CREATE_MATERIAL,
      localId: material,
      data: {
        r: colour.r * 255,
        g: colour.g * 255,
        b: colour.b * 255,
        a: 255,
        renderedFaces: 0,
        stroke: 0,
      },
    },
    { type: Edit.CREATE_LOCAL_TRANSFORM, localId: localTransform, data: identity },
  )
  for (const wall of new Set(Object.values(snapshot.doc.walls).map(elementId))) {
    const itemId = ids.get(`elements:${wall}`)
    if (itemId === undefined) throw new Error(`Fragment wall ${wall} is missing`)
    const geometry = await wallGeometry(snapshot.doc, wall, generate)
    try {
      const representation = next++,
        globalTransform = next++,
        sample = next++
      requests.push(
        {
          type: Edit.CREATE_REPRESENTATION,
          localId: representation,
          data: GeomsFbUtils.representationFromGeometry(geometry),
        },
        {
          type: Edit.CREATE_GLOBAL_TRANSFORM,
          localId: globalTransform,
          data: { ...identity, itemId },
        },
        {
          type: Edit.CREATE_SAMPLE,
          localId: sample,
          data: { item: globalTransform, representation, material, localTransform },
        },
      )
    } finally {
      geometry.dispose()
    }
  }
  requests.push({ type: Edit.UPDATE_MAX_LOCAL_ID, localId: next })
  const archive = EditUtils.edit(base, requests, { raw: false, delta: false }).model
  return { format: 'houseit-fragments', version: 1, buffer: new Uint8Array(archive).slice().buffer }
}

function snapshotRequests(
  snapshot: FragmentSnapshot,
  base: ReturnType<typeof EditUtils.getModelFromBuffer>,
) {
  const requests: EditRequest[] = []
  for (const [kind, originalIds, create, update, remove] of [
    ['ITEM', EditUtils.getItemsIds(base), Edit.CREATE_ITEM, Edit.UPDATE_ITEM, Edit.DELETE_ITEM],
    [
      'RELATION',
      base.relationsItemsArray() ?? [],
      Edit.CREATE_RELATION,
      Edit.UPDATE_RELATION,
      Edit.DELETE_RELATION,
    ],
  ] as const) {
    const original = new Set(originalIds)
    const records = new Map<number, RawItemData | RawRelationData>()
    EditUtils.applyChangesToRawData(snapshot.requests, records, kind)
    const changed = new Set(
      snapshot.requests.flatMap((request) =>
        (request.type === create || request.type === update || request.type === remove) &&
        typeof request.localId === 'number'
          ? [request.localId]
          : [],
      ),
    )
    for (const localId of changed) {
      const data = records.get(localId)
      if (data)
        requests.push({
          type: original.has(localId) ? update : create,
          localId,
          data,
        } as EditRequest)
      else if (original.has(localId)) requests.push({ type: remove, localId })
    }
  }
  return requests
}

async function wallGeometry(doc: HouseDocument, id: string, generate: WallGeometry) {
  const parts: BufferGeometry[] = []
  try {
    for (const wall of Object.values(doc.walls).filter((w) => elementId(w) === id)) {
      const data = await generate(wallBody(doc, wall))
      const geometry = new BufferGeometry()
      parts.push(geometry)
      geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3))
      geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3))
      const a = doc.nodes[wall.a]!,
        b = doc.nodes[wall.b]!
      const transform = new Matrix4().makeRotationY(Math.atan2(b.y - a.y, b.x - a.x))
      transform.setPosition(
        a.x / 1000,
        (doc.levels[wall.level]!.elevation + wall.baseOffset) / 1000,
        -a.y / 1000,
      )
      geometry.applyMatrix4(transform)
    }
    const result = mergeGeometries(parts)
    if (!result) throw new Error(`Could not assemble Fragment wall ${id}`)
    result.setIndex(Array.from({ length: result.getAttribute('position').count }, (_, i) => i))
    return result
  } finally {
    for (const geometry of parts) geometry.dispose()
  }
}
