// @vitest-environment node

import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import { geometryEntityKey } from '@houseit/core/entity-key'
import { enclosuresOf } from '@houseit/geometry/enclosure'
import {
  EditRequestType as Edit,
  type EditRequest,
  EditUtils,
  GeometryEngine,
  SingleThreadedFragmentsModel,
} from '@thatopen/fragments'
import { IDBFactory } from 'fake-indexeddb'
import { Color, Plane, Vector3 } from 'three'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { IfcAPI } from 'web-ifc'
import { createDocumentStore } from '../store/document-store'
import { fragmentCodec } from '../store/projects/codec'
import { openProjects } from '../store/projects/db'
import { createProjectsStore } from '../store/projects/project-store'
import { nativeKey } from './authoring-graph'
import { FragmentAuthoring } from './fragment-authoring'
import { writeFragment } from './fragment-project'

import { generateGeometry } from './generate-geometry'
import type { GeometryInput } from './geometry-protocol'

vi.mock('./archive-resources', () => ({
  loadArchiveAsset: async (path: string) => {
    if (path === 'houseit:ground')
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZncAAAAASUVORK5CYII='
    const bytes = readFileSync(new URL(`../../public${path}`, import.meta.url))
    return `data:application/octet-stream;base64,${bytes.toString('base64')}`
  },
}))

vi.mock('./geometry-session', () => ({
  acquireGeometry: () => ({
    engine: { geometry: (input: GeometryInput) => generate(input) },
    release: () => {},
  }),
}))

vi.setConfig({ testTimeout: 30000 })

const api = new IfcAPI()
let engine: GeometryEngine
beforeAll(async () => {
  await api.Init(undefined, true)
  engine = new GeometryEngine(api)
})
afterAll(() => api.Dispose())

const generate = async (input: GeometryInput) => {
  const geometry = generateGeometry(engine, input)
  try {
    return {
      positions: new Float32Array(geometry.getAttribute('position').array),
      normals: new Float32Array(geometry.getAttribute('normal').array),
      uv: new Float32Array(geometry.getAttribute('uv').array),
      groups: geometry.groups,
    }
  } finally {
    geometry.dispose()
  }
}
const make = () => {
  const authoring = new FragmentAuthoring(createEmptyDocument())
  const level = Object.keys(authoring.document.levels)[0]!
  authoring.exec(
    `add-wall --from '{"x":0,"y":0}' --to '{"x":5000,"y":0}' --thickness 300
add-opening --wall w1 --kind window --along 2000 --width 1200
add-device --kind socket --wall w1 --along 4000 --height 300`,
    level,
  )
  return { authoring, level }
}
const savedModel = (buffer: ArrayBuffer) =>
  new SingleThreadedFragmentsModel('saved', new Uint8Array(buffer), false)

test('the archive retains the live native graph and ids, with actual wall geometry and no extra history', async () => {
  const { authoring, level } = make()
  try {
    const first = authoring.graph,
      history = authoring.history
    const archive = await writeFragment(authoring.snapshot(), generate)
    const loaded = new FragmentAuthoring(new Uint8Array(archive.buffer))
    const model = savedModel(archive.buffer)
    try {
      expect(loaded.graph).toEqual(first)
      expect(loaded.document).toEqual(authoring.document)
      expect(loaded.history.canUndo).toBe(false)
      const wall = [...first.items].find(([, item]) => nativeKey(item) === 'elements:w1')![0]
      expect(new Set(model.getItemsIdsWithGeometry())).toEqual(
        new Set(
          [...first.items]
            .filter(([, item]) =>
              ['elements:w1', geometryEntityKey('IFCWINDOW', 'openings:o1'), 'terrain'].includes(
                nativeKey(item)!,
              ),
            )
            .map(([id]) => id),
        ),
      )
      expect(model.getItemsVolume([wall])).toBeCloseTo(5 * 2.55 * 0.3 - 1.2 * 1.5 * 0.3, 4)
      expect(model.getMetadata()).toMatchObject({
        houseit: { schema: 4, geometry: { version: 1 } },
      })
      const material = [...model.getMaterials().values()][0]!
      const colour = new Color('#f1f0ed').convertLinearToSRGB()
      expect(material.a).toBe(255)
      for (const channel of ['r', 'g', 'b'] as const)
        expect(Math.abs(material[channel] - colour[channel] * 255)).toBeLessThan(1)
      expect(authoring.history).toEqual(history)
      authoring.exec('update-wall --id w1 --by 500', level)
      const moved = authoring.graph
      const changed = await writeFragment(authoring.snapshot(), generate)
      const changedAuthoring = new FragmentAuthoring(new Uint8Array(changed.buffer))
      try {
        expect(changedAuthoring.graph).toEqual(moved)
        expect(changedAuthoring.document).toEqual(authoring.document)
      } finally {
        changedAuthoring.dispose()
      }
      const changedModel = savedModel(changed.buffer)
      try {
        expect(new Set(changedModel.getItemsIdsWithGeometry())).toEqual(
          new Set(model.getItemsIdsWithGeometry()),
        )
      } finally {
        changedModel.dispose()
      }
      authoring.undo()
      expect(authoring.graph).toEqual(first)
      await writeFragment(authoring.snapshot(), generate)
      authoring.redo()
      expect(authoring.graph).toEqual(moved)
    } finally {
      loaded.dispose()
      model.dispose()
    }
  } finally {
    authoring.dispose()
  }
})

test('a captured revision survives later edits, undo and disposal while geometry is pending', async () => {
  const { authoring, level } = make()
  const first = authoring.graph,
    doc = authoring.document
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const saved = writeFragment(authoring.snapshot(), async (body) => {
    await pending
    return generate(body)
  })
  authoring.exec('update-wall --id w1 --length 6000', level)
  authoring.undo()
  authoring.exec('update-wall --id w1 --by 800', level)
  authoring.dispose()
  release()
  const archive = await saved
  const loaded = new FragmentAuthoring(new Uint8Array(archive.buffer))
  try {
    expect(loaded.graph).toEqual(first)
    expect(loaded.document).toEqual(doc)
  } finally {
    loaded.dispose()
  }
})

test('failed geometry export preserves the native redo branch and can be retried', async () => {
  const { authoring, level } = make()
  try {
    authoring.exec('update-wall --id w1 --by 500', level)
    const moved = authoring.graph
    authoring.undo()
    const graph = authoring.graph,
      history = authoring.history
    await expect(
      writeFragment(authoring.snapshot(), async () => {
        throw new Error('Geometry failed')
      }),
    ).rejects.toThrow('Geometry failed')
    expect(authoring.graph).toEqual(graph)
    expect(authoring.history).toEqual(history)
    await writeFragment(authoring.snapshot(), generate)
    authoring.redo()
    expect(authoring.graph).toEqual(moved)
  } finally {
    authoring.dispose()
  }
})

test('loading an old native id counter reserves geometry ids and removes deleted wall geometry', async () => {
  const { authoring, level } = make()
  try {
    const archive = await writeFragment(authoring.snapshot(), generate)
    const base = EditUtils.getModelFromBuffer(new Uint8Array(archive.buffer), false)
    const brokenCounter = EditUtils.edit(base, [{ type: Edit.UPDATE_MAX_LOCAL_ID, localId: 1 }], {
      raw: false,
      delta: false,
    }).model
    const loaded = new FragmentAuthoring(brokenCounter)
    try {
      loaded.exec('remove-device --id d1\nremove-wall --id w1', level)
      const empty = await writeFragment(loaded.snapshot(), generate)
      const model = savedModel(empty.buffer)
      try {
        expect(model.getItemsIdsWithGeometry()).toEqual([
          [...loaded.graph.items].find(([, item]) => nativeKey(item) === 'terrain')![0],
        ])
        expect(model.getSamplesIds()).toHaveLength(1)
      } finally {
        model.dispose()
      }
      loaded.exec(`add-wall --from '{"x":0,"y":0}' --to '{"x":7000,"y":0}' --thickness 200`, level)
      const rebuilt = await writeFragment(loaded.snapshot(), generate)
      const again = new FragmentAuthoring(new Uint8Array(rebuilt.buffer))
      try {
        expect(again.graph).toEqual(loaded.graph)
      } finally {
        again.dispose()
      }
      loaded.undo()
      loaded.undo()
      expect(loaded.graph).toEqual(authoring.graph)
    } finally {
      loaded.dispose()
    }
  } finally {
    authoring.dispose()
  }
})

test('native save mutates the request log, so archive snapshots use the non-mutating public EditUtils path', () => {
  const { authoring } = make()
  try {
    const snapshot = authoring.snapshot()
    const model = new SingleThreadedFragmentsModel('probe', snapshot.base, true)
    try {
      model.edit(snapshot.requests)
      const length = model.getRequests().requests.length
      model.save(false)
      expect(model.getRequests().requests.length).toBe(length + 1)
      expect(model.getRequests().requests.at(-1)?.type).toBe(Edit.UPDATE_MAX_LOCAL_ID)
    } finally {
      model.dispose()
    }
  } finally {
    authoring.dispose()
  }
})

test('an archive written before unification opens with the same ids and survives further edits', async () => {
  const buffer = readFileSync(
    new URL('../../../../fixtures/that-open/archive-before-unification.frag', import.meta.url),
  )
  const authoring = new FragmentAuthoring(new Uint8Array(buffer))
  try {
    const before = authoring.graph
    expect(Object.keys(authoring.document.rooms)).toHaveLength(7)
    expect(Object.keys(authoring.document.objects)).toHaveLength(11)
    authoring.exec('update-wall --id w3 --by -400', Object.keys(authoring.document.levels)[0]!)
    const moved = authoring.graph
    const archive = await writeFragment(authoring.snapshot(), generate)
    const loaded = new FragmentAuthoring(new Uint8Array(archive.buffer))
    try {
      expect(loaded.graph).toEqual(moved)
      expect(loaded.document).toEqual(authoring.document)
    } finally {
      loaded.dispose()
    }
    authoring.undo()
    expect(authoring.graph).toEqual(before)
    authoring.redo()
    expect(authoring.graph).toEqual(moved)
  } finally {
    authoring.dispose()
  }
})

test('a damaged archive with a missing wall representation is refused', async () => {
  const { authoring } = make()
  try {
    const archive = await writeFragment(authoring.snapshot(), generate)
    const base = EditUtils.getModelFromBuffer(new Uint8Array(archive.buffer), false)
    const broken = EditUtils.edit(
      base,
      Array.from(EditUtils.getSamplesIds(base), (localId) => ({
        type: Edit.DELETE_SAMPLE as const,
        localId,
      })),
      { raw: false, delta: false },
    ).model
    expect(() => new FragmentAuthoring(broken)).toThrow(/Fragment geometry/)
  } finally {
    authoring.dispose()
  }
})

test('project autosave captures each revision from the live native model and restores the exact archive', async () => {
  const db = await openProjects(new IDBFactory())
  const docs = createDocumentStore()
  const projects = createProjectsStore(async () => db, docs, fragmentCodec())
  const project = await projects.getState().create('Native autosave')
  try {
    await projects.getState().openProject(project.id)
    docs.getState().exec(`add-wall --from '{"x":0,"y":0}' --to '{"x":5000,"y":0}' --thickness 300`)
    await projects.getState().save()
    const first = docs.getState().authoring.graph
    docs.getState().exec('update-wall --id w1 --length 6000\nupdate-wall --id w1 --by 500')
    const moved = docs.getState().authoring.graph
    await projects.getState().save()
    const stored = (await db.read(project.id)) as { buffer: ArrayBuffer }
    const loaded = new FragmentAuthoring(new Uint8Array(stored.buffer))
    try {
      expect(loaded.graph).toEqual(moved)
      expect(loaded.document).toEqual(docs.getState().doc)
    } finally {
      loaded.dispose()
    }
    docs.getState().undo()
    expect(docs.getState().authoring.graph).toEqual(first)
    await projects.getState().save()
    docs.getState().redo()
    expect(docs.getState().authoring.graph).toEqual(moved)
    await projects.getState().save()
    const archived = await db.read(project.id)
    const removed = await projects.getState().remove(project.id)
    await projects.getState().restore(removed!)
    expect(await db.read(project.id)).toEqual(archived)
    await projects.getState().openProject(project.id)
    expect(docs.getState().authoring.graph).toEqual(moved)
  } finally {
    await projects.getState().closeProject()
    docs.getState().authoring.dispose()
  }
})

test('schema-one archives upgrade their metadata into native relationships without changing wall ids', async () => {
  const { authoring } = make()
  try {
    const archive = await writeFragment(authoring.snapshot(), generate)
    const base = EditUtils.getModelFromBuffer(new Uint8Array(archive.buffer), false)
    const wallItems: Record<string, number> = {}
    const requests: EditRequest[] = []
    for (const [localId, item] of authoring.graph.items) {
      const key = nativeKey(item)!
      if (key.startsWith('elements:')) {
        wallItems[key.slice('elements:'.length)] = localId
        requests.push({
          type: Edit.UPDATE_ITEM,
          localId,
          data: { category: 'IFCWALL', data: { Name: { value: key } } },
        })
      } else requests.push({ type: Edit.DELETE_ITEM, localId })
    }
    for (const localId of base.relationsItemsArray() ?? [])
      requests.push({ type: Edit.DELETE_RELATION, localId })
    requests.push({
      type: Edit.UPDATE_METADATA,
      localId: 0,
      data: { houseit: { schema: 1, document: authoring.document, wallItems } },
    })
    const legacy = EditUtils.edit(base, [...requests, ...wallOnlyGeometry(base)], {
      raw: false,
      delta: false,
    }).model
    const loaded = new FragmentAuthoring(legacy)
    try {
      expect(loaded.document).toEqual(authoring.document)
      expect(
        [...loaded.graph.items].find(([, item]) => nativeKey(item) === 'elements:w1')![0],
      ).toBe(wallItems.w1)
      const saved = await writeFragment(loaded.snapshot(), generate)
      const next = new FragmentAuthoring(new Uint8Array(saved.buffer))
      try {
        expect(next.graph).toEqual(loaded.graph)
      } finally {
        next.dispose()
      }
    } finally {
      loaded.dispose()
    }
  } finally {
    authoring.dispose()
  }
})

test.each(['columns', 'connections', 'three-flights', 'site'])(
  '%s independent elements survive archive load and editing with the same native IDs',
  async (name) => {
    const authoring = new FragmentAuthoring(createEmptyDocument())
    try {
      const level = Object.keys(authoring.document.levels)[0]!
      authoring.exec(
        readFileSync(
          new URL(`../../../../fixtures/building-proof/${name}.txt`, import.meta.url),
          'utf8',
        ),
        level,
      )
      const graph = authoring.graph
      const archive = await writeFragment(authoring.snapshot(), generate)
      const loaded = new FragmentAuthoring(new Uint8Array(archive.buffer))
      const native = savedModel(archive.buffer)
      try {
        const visible = new Set(native.getItemsIdsWithGeometry())
        for (const [id, item] of graph.items) {
          if (item.category === 'IFCSPACE' || item.category === 'IFCOPENINGELEMENT')
            expect(visible.has(id), nativeKey(item)).toBe(false)
          if (
            [
              'IFCWALL',
              'IFCCOLUMN',
              'IFCROOF',
              'IFCRAMP',
              'IFCSTAIR',
              'IFCBUILDINGELEMENTPROXY',
              'IFCSITE',
              'IFCGEOGRAPHICELEMENT',
              'IFCSURFACEFEATURE',
              'IFCRAILING',
            ].includes(item.category)
          )
            expect(visible.has(id), nativeKey(item)).toBe(true)
        }
        for (const meshes of native.getItemsGeometry([...visible])) {
          expect(meshes.length).toBeGreaterThan(0)
          for (const mesh of meshes) expect(mesh.positions!.length).toBeGreaterThan(0)
        }
        const metadata = native.getMetadata() as {
          houseit: { geometry: { parts: { samples: number[] }[] }; assets: Record<string, string> }
        }
        expect(new Set(metadata.houseit.geometry.parts.flatMap((part) => part.samples))).toEqual(
          new Set(native.getSamplesIds()),
        )
        if (name === 'columns')
          expect(
            Object.values(metadata.houseit.assets).some(
              (asset) => asset.startsWith('data:') && asset.length > 1000,
            ),
          ).toBe(true)
        expect(loaded.graph).toEqual(graph)
        expect(loaded.document).toEqual(authoring.document)
        loaded.exec('update-level --name Renamed', level)
        expect([...loaded.graph.items.keys()]).toEqual([...graph.items.keys()])
        loaded.undo()
        expect(loaded.graph).toEqual(graph)
        loaded.redo()
        const saved = await writeFragment(loaded.snapshot(), generate)
        const again = new FragmentAuthoring(new Uint8Array(saved.buffer))
        try {
          expect(again.graph).toEqual(loaded.graph)
        } finally {
          again.dispose()
        }
      } finally {
        loaded.dispose()
        native.dispose()
      }
    } finally {
      authoring.dispose()
    }
  },
  30000,
)

test('schema-two nested archives upgrade to independent elements and retain existing item IDs', async () => {
  const authoring = new FragmentAuthoring(createEmptyDocument())
  try {
    const level = Object.keys(authoring.document.levels)[0]!
    authoring.exec(
      readFileSync(
        new URL('../../../../fixtures/building-proof/columns.txt', import.meta.url),
        'utf8',
      ),
      level,
    )
    const archive = await writeFragment(authoring.snapshot(), generate)
    const base = EditUtils.getModelFromBuffer(new Uint8Array(archive.buffer), false)
    const requests: EditRequest[] = []
    const retained = new Map<string, number>()
    for (const [localId, original] of authoring.graph.items) {
      const key = nativeKey(original)!
      if (
        key === 'terrain' ||
        key.startsWith('columns:') ||
        key.startsWith('roofs:') ||
        key.startsWith('geometry:')
      ) {
        requests.push({ type: Edit.DELETE_ITEM, localId }, { type: Edit.DELETE_RELATION, localId })
        continue
      }
      retained.set(key, localId)
      const item = structuredClone(original)
      delete item.data.NestedCollections
      const relations = structuredClone(authoring.graph.relations.get(localId) ?? { data: {} })
      for (const name of Object.keys(relations.data))
        if (name === 'ContainsTerrain' || name === 'HasGeometry' || name.startsWith('HasParts:'))
          delete relations.data[name]
      item.data.RelationCounts = {
        value: JSON.stringify(
          Object.fromEntries(
            Object.entries(relations.data).map(([name, targets]) => [name, targets.length]),
          ),
        ),
      }
      if (key.startsWith('levels:')) {
        const storey = structuredClone(authoring.document.levels[key.slice('levels:'.length)]!)
        for (const roof of storey.roofs ?? []) delete roof.id
        item.data.Parameters = { value: JSON.stringify(storey) }
      }
      requests.push({ type: Edit.UPDATE_ITEM, localId, data: item })
      requests.push({ type: Edit.UPDATE_RELATION, localId, data: relations })
    }
    requests.push({ type: Edit.UPDATE_METADATA, localId: 0, data: { houseit: { schema: 2 } } })
    const legacy = EditUtils.edit(base, [...requests, ...wallOnlyGeometry(base)], {
      raw: false,
      delta: false,
    }).model
    const loaded = new FragmentAuthoring(legacy)
    try {
      expect(loaded.document).toEqual(authoring.document)
      const keys = new Map([...loaded.graph.items].map(([id, item]) => [nativeKey(item), id]))
      for (const [key, id] of retained) expect(keys.get(key)).toBe(id)
      const saved = await writeFragment(loaded.snapshot(), generate)
      const again = new FragmentAuthoring(new Uint8Array(saved.buffer))
      try {
        expect(again.graph).toEqual(loaded.graph)
      } finally {
        again.dispose()
      }
    } finally {
      loaded.dispose()
    }
  } finally {
    authoring.dispose()
  }
})

function wallOnlyGeometry(base: ReturnType<typeof EditUtils.getModelFromBuffer>): EditRequest[] {
  const items = EditUtils.getItems(base)
  const transforms = EditUtils.getGlobalTransforms(base)
  const removed = new Set(
    [...transforms]
      .filter(
        ([, transform]) =>
          !nativeKey(items.get(Number(transform.itemId))!)?.startsWith('elements:'),
      )
      .map(([id]) => id),
  )
  return [
    ...[...EditUtils.getSamples(base)]
      .filter(([, sample]) => removed.has(Number(sample.item)))
      .map(([localId]) => ({ type: Edit.DELETE_SAMPLE as const, localId })),
    ...[...removed].map((localId) => ({ type: Edit.DELETE_GLOBAL_TRANSFORM as const, localId })),
  ]
}

test('the full archive rejects missing non-wall samples and wrong geometry ownership', async () => {
  const { authoring } = make()
  try {
    const archive = await writeFragment(authoring.snapshot(), generate)
    const base = EditUtils.getModelFromBuffer(new Uint8Array(archive.buffer), false)
    const model = savedModel(archive.buffer)
    try {
      const metadata = model.getMetadata() as {
        houseit: { geometry: { parts: { id: string; item: number; samples: number[] }[] } }
      }
      const ground = metadata.houseit.geometry.parts.find((part) => part.id === 'terrain:ground')!
      const missing = EditUtils.edit(
        base,
        [{ type: Edit.DELETE_SAMPLE, localId: ground.samples[0]! }],
        { raw: false, delta: false },
      ).model
      expect(() => new FragmentAuthoring(missing)).toThrow(
        /Incomplete Fragment geometry terrain:ground/,
      )
      ground.item = [...authoring.graph.items].find(
        ([, item]) => nativeKey(item) === 'elements:w1',
      )![0]
      const wrong = EditUtils.edit(
        base,
        [{ type: Edit.UPDATE_METADATA, localId: 0, data: metadata }],
        { raw: false, delta: false },
      ).model
      expect(() => new FragmentAuthoring(wrong)).toThrow(
        /Invalid Fragment geometry owner terrain:ground/,
      )
    } finally {
      model.dispose()
    }
  } finally {
    authoring.dispose()
  }
})

test('physical floor and slab items participate in native sections without turning rooms into solids', async () => {
  const authoring = new FragmentAuthoring(createEmptyDocument())
  try {
    const level = Object.keys(authoring.document.levels)[0]!
    authoring.exec('add-room --name Living --width 5000 --depth 4000 --material natural-oak', level)
    const room = Object.keys(authoring.document.rooms)[0]!
    const archive = await writeFragment(authoring.snapshot(), generate)
    const model = savedModel(archive.buffer)
    try {
      const ids = new Map([...authoring.graph.items].map(([id, item]) => [nativeKey(item), id]))
      const visible = new Set(model.getItemsIdsWithGeometry())
      const parent = ids.get(`rooms:${room}`)!
      expect(visible.has(parent)).toBe(false)
      for (const category of ['IFCCOVERING', 'IFCSLAB']) {
        const item = ids.get(geometryEntityKey(category, `rooms:${room}`))!
        expect(visible.has(item)).toBe(true)
        expect(authoring.graph.relations.get(item)!.data.PartOf).toEqual([parent])
        const section = model.getSection(new Plane(new Vector3(1, 0, 0), -2.5), [item])
        expect(section.index).toBeGreaterThan(0)
      }
    } finally {
      model.dispose()
    }
  } finally {
    authoring.dispose()
  }
})

test('schema-three archives retain native geometry and existing identities during physical-category upgrade', async () => {
  const { authoring, level } = make()
  try {
    const archive = await writeFragment(authoring.snapshot(), generate)
    const base = EditUtils.getModelFromBuffer(new Uint8Array(archive.buffer), false)
    const keys = new Map([...authoring.graph.items].map(([id, item]) => [nativeKey(item), id]))
    const owners = new Map<number, { id: number; key: string }>()
    const requests: EditRequest[] = []
    for (const [id, original] of authoring.graph.items) {
      const key = nativeKey(original)!
      if (key.startsWith('geometry:')) {
        const [, owner] = JSON.parse(key.slice('geometry:'.length)) as [string, string]
        owners.set(id, { id: keys.get(owner)!, key: owner })
        requests.push(
          { type: Edit.DELETE_ITEM, localId: id },
          { type: Edit.DELETE_RELATION, localId: id },
        )
      } else {
        const relation = structuredClone(authoring.graph.relations.get(id) ?? { data: {} })
        delete relation.data.HasGeometry
        const item = structuredClone(original)
        item.data.RelationCounts = {
          value: JSON.stringify(
            Object.fromEntries(
              Object.entries(relation.data).map(([name, ids]) => [name, ids.length]),
            ),
          ),
        }
        requests.push(
          { type: Edit.UPDATE_ITEM, localId: id, data: item },
          { type: Edit.UPDATE_RELATION, localId: id, data: relation },
        )
      }
    }
    for (const [id, transform] of EditUtils.getGlobalTransforms(base)) {
      const owner = owners.get(Number(transform.itemId))
      if (owner)
        requests.push({
          type: Edit.UPDATE_GLOBAL_TRANSFORM,
          localId: id,
          data: { ...transform, itemId: owner.id },
        })
    }
    const metadata = JSON.parse(base.metadata()!)
    metadata.houseit.schema = 3
    for (const part of metadata.houseit.geometry.parts) {
      const owner = owners.get(part.item)
      if (owner) {
        part.entity = owner.key
        part.item = owner.id
      }
    }
    requests.push({ type: Edit.UPDATE_METADATA, localId: 0, data: metadata })
    const legacy = EditUtils.edit(base, requests, { raw: false, delta: false }).model
    const loaded = new FragmentAuthoring(legacy)
    try {
      expect(loaded.document).toEqual(authoring.document)
      const upgraded = new Map([...loaded.graph.items].map(([id, item]) => [nativeKey(item), id]))
      for (const [key, id] of keys) if (!owners.has(id)) expect(upgraded.get(key)).toBe(id)
      loaded.exec('update-wall --id w1 --by 200', level)
      loaded.undo()
      const saved = await writeFragment(loaded.snapshot(), generate)
      const model = savedModel(saved.buffer)
      try {
        expect(new Set(model.getItemsIdsWithGeometry())).toContain(
          upgraded.get(geometryEntityKey('IFCWINDOW', 'openings:o1')),
        )
        expect(new Set(model.getItemsIdsWithGeometry())).not.toContain(upgraded.get('openings:o1'))
      } finally {
        model.dispose()
      }
    } finally {
      loaded.dispose()
    }
  } finally {
    authoring.dispose()
  }
})

test('cadastral outdoor demo archives its parcel, open edges and glazed garden through native geometry', async () => {
  const authoring = new FragmentAuthoring(createEmptyDocument())
  const level = Object.keys(authoring.document.levels)[0]!
  try {
    authoring.exec(
      readFileSync(
        new URL('../../../../fixtures/that-open/parcel-outdoor.txt', import.meta.url),
        'utf8',
      ),
      level,
    )
    expect(authoring.document.parcelSite?.parcel.number).toBe('1')
    const archive = await writeFragment(authoring.snapshot(), generate)
    const loaded = new FragmentAuthoring(new Uint8Array(archive.buffer))
    const model = savedModel(archive.buffer)
    try {
      expect(loaded.document).toEqual(authoring.document)
      expect(loaded.graph).toEqual(authoring.graph)
      const enclosures = enclosuresOf(authoring.document, level)
      const withGeometry = new Set(model.getItemsIdsWithGeometry())
      const glass = [...authoring.graph.items].filter(([, item]) => {
        const key = nativeKey(item)
        return (
          key?.startsWith('elements:') && enclosures.get(key.slice('elements:'.length)) === 'glass'
        )
      })
      expect(glass.length).toBeGreaterThan(0)
      for (const [id] of glass) expect(withGeometry.has(id)).toBe(true)
      expect([...model.getMaterials().values()].some((paint) => paint.a > 0 && paint.a < 255)).toBe(
        true,
      )
      loaded.exec('remove-site', level)
      loaded.undo()
      expect(loaded.document).toEqual(authoring.document)
    } finally {
      loaded.dispose()
      model.dispose()
    }
  } finally {
    authoring.dispose()
  }
}, 30000)
