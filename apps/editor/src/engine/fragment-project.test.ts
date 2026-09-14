// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import {
  EditRequestType as Edit,
  type EditRequest,
  EditUtils,
  GeometryEngine,
  SingleThreadedFragmentsModel,
} from '@thatopen/fragments'
import { IDBFactory } from 'fake-indexeddb'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { IfcAPI } from 'web-ifc'
import { createDocumentStore } from '../store/document-store'
import { fragmentCodec } from '../store/projects/codec'
import { openProjects } from '../store/projects/db'
import { createProjectsStore } from '../store/projects/project-store'
import { nativeKey } from './authoring-graph'
import { FragmentAuthoring } from './fragment-authoring'
import { writeFragment } from './fragment-project'
import type { WallBody } from './wall-body'
import { wallGeometry } from './wall-geometry'

vi.mock('./geometry-session', () => ({
  acquireGeometry: () => ({
    engine: { wall: (body: WallBody) => generate(body) },
    release: () => {},
  }),
}))

const api = new IfcAPI()
let engine: GeometryEngine
beforeAll(async () => {
  await api.Init(undefined, true)
  engine = new GeometryEngine(api)
})
afterAll(() => api.Dispose())

const generate = async (body: WallBody) => {
  const geometry = wallGeometry(engine, body)
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
      expect(model.getItemsIdsWithGeometry()).toEqual([wall])
      expect(model.getItemsVolume([wall])).toBeCloseTo(5 * 2.55 * 0.3 - 1.2 * 1.5 * 0.3, 4)
      expect(model.getMetadata()).toEqual({ houseit: { schema: 2 } })
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
        expect(changedModel.getItemsIdsWithGeometry()).toEqual([wall])
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
        expect(model.getItemsIdsWithGeometry()).toEqual([])
        expect(model.getSamplesIds()).toEqual([])
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
    const legacy = EditUtils.edit(base, requests, { raw: false, delta: false }).model
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
