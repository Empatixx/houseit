import * as OBC from '@thatopen/components'
import {
  EditRequestType as Edit,
  type EditRequest,
  EditUtils,
  type FragmentsModel,
  GeomsFbUtils,
  LodMode,
} from '@thatopen/fragments'
import workerUrl from '@thatopen/fragments/worker?url'
import {
  type BufferGeometry,
  type Material,
  type Matrix4,
  Mesh,
  type Object3D,
  type OrthographicCamera,
  type PerspectiveCamera,
} from 'three'
import type { Selection } from '../store/selection'
import { mapFragmentTile, styleFragmentTile, tileItemIds } from './fragment-tile'

export type DisplaySurface = {
  id: string
  geometry: BufferGeometry
  materials: Material[]
  transform: Matrix4
  mapping: { kind: 'wall'; length: number; height: number } | { kind: 'flat' }
  owner?: Selection
  category: string
  casts: boolean
}

type Entry = {
  surface: DisplaySurface
  item: number
  global: number
  representation: number
  sample: number
}
const identity = { position: [0, 0, 0], xDirection: [1, 0, 0], yDirection: [0, 1, 0] }

export class FragmentDisplay {
  readonly components = new OBC.Components()
  readonly fragments = this.components.get(OBC.FragmentsManager)
  readonly id = 'houseit-display'
  readonly owners = new Map<number, Selection>()
  readonly surfaces = new Map<string, DisplaySurface>()
  readonly roots = new Set<Object3D>()
  error: string | null = null
  private preparing = new Set<Promise<void>>()
  revision = 0
  toolsDisposal: Promise<void> | undefined
  private entries = new Map<string, Entry>()
  private nextId = 3
  private dirty = false
  private dead = false
  private loaded = false
  private work: Promise<void> | null = null
  private cameraKey = ''

  constructor(
    private camera: () => PerspectiveCamera | OrthographicCamera,
    private changed: () => void,
    private report: (error: unknown) => void,
  ) {
    this.fragments.init(workerUrl)
    this.fragments.core.settings.autoCoordinate = false
    this.fragments.list.onItemSet.add(({ value: model }) => {
      if (model.modelId !== this.id && model.parentModelId !== this.id) return
      model.object.userData.houseitNative = true
      model.useCamera.bind(model)(this.camera())
      model.tiles.onItemSet.add(({ value: mesh }) => this.prepare(model, mesh))
      model.onViewUpdated.add(() => {
        for (const mesh of model.tiles.values()) this.prepare(model, mesh)
      })
      if (!model.isDeltaModel) {
        this.roots.add(model.object)
        this.changed()
      }
    })
    this.fragments.list.onItemDeleted.add((id) => {
      for (const root of this.roots) if (root.name === id) this.roots.delete(root)
      this.changed()
    })
  }

  private fail = (error: unknown) => {
    if (this.dead) return
    this.error = error instanceof Error ? error.message : String(error)
    this.report(error)
  }
  get busy() {
    return this.dirty || !!this.work || this.preparing.size > 0
  }
  get model() {
    return (
      [...this.fragments.list.values()].find((model) => model.parentModelId === this.id) ??
      this.fragments.list.get(this.id)
    )
  }
  get localIds() {
    return new Set([...this.entries.values()].map((entry) => entry.item))
  }
  ids(owner: Selection): OBC.ModelIdMap {
    const ids = [...this.owners]
      .filter(([, value]) => value.kind === owner.kind && value.id === owner.id)
      .map(([id]) => id)
    return ids.length && this.model ? { [this.model.modelId]: new Set(ids) } : {}
  }
  set(surface: DisplaySurface) {
    if (!surface.geometry.getAttribute('position').count) {
      this.remove(surface.id)
      return
    }
    this.surfaces.set(surface.id, surface)
    this.dirty = true
  }
  remove(id: string) {
    this.surfaces.delete(id)
    this.dirty = true
  }
  frame(preview = false) {
    if (this.dead) return
    const camera = this.camera()
    const key = `${camera.uuid}:${camera.matrixWorld.elements}:${camera.projectionMatrix.elements}`
    if (key !== this.cameraKey && !this.work) {
      this.cameraKey = key
      for (const model of this.fragments.list.values()) model.useCamera.bind(model)(camera)
      void this.fragments.core.update().catch(this.fail)
    }
    if (this.dirty && !this.work && !preview) {
      this.dirty = false
      this.work = this.sync()
        .catch(this.fail)
        .finally(() => {
          this.work = null
        })
    }
  }
  private async sync() {
    if (!this.loaded) {
      const base = EditUtils.getModelFromBuffer(EditUtils.newModel({ raw: true }), true)
      const buffer = EditUtils.edit(
        base,
        [
          {
            type: Edit.CREATE_MATERIAL,
            localId: 0,
            data: { r: 241, g: 240, b: 237, a: 255, renderedFaces: 0, stroke: 0 },
          },
          {
            type: Edit.CREATE_MATERIAL,
            localId: 2,
            data: { r: 247, g: 247, b: 245, a: 255, renderedFaces: 0, stroke: 0 },
          },
          { type: Edit.CREATE_LOCAL_TRANSFORM, localId: 1, data: identity },
        ],
        { raw: true, delta: false },
      ).model
      await this.fragments.core.load(buffer, { modelId: this.id, raw: true })
      this.loaded = true
    }
    if (this.dead) return
    const requests: EditRequest[] = []
    for (const [id, entry] of this.entries) {
      if (this.surfaces.has(id)) continue
      requests.push(
        { type: Edit.DELETE_SAMPLE, localId: entry.sample },
        { type: Edit.DELETE_REPRESENTATION, localId: entry.representation },
        { type: Edit.DELETE_GLOBAL_TRANSFORM, localId: entry.global },
        { type: Edit.DELETE_ITEM, localId: entry.item },
      )
      this.entries.delete(id)
      this.owners.delete(entry.item)
    }
    for (const surface of this.surfaces.values()) {
      let entry = this.entries.get(surface.id)
      const old = entry?.surface
      if (!entry) {
        entry = {
          surface,
          item: this.nextId++,
          global: this.nextId++,
          representation: this.nextId++,
          sample: this.nextId++,
        }
        this.entries.set(surface.id, entry)
        if (surface.owner) this.owners.set(entry.item, surface.owner)
        requests.push({
          type: Edit.CREATE_ITEM,
          localId: entry.item,
          data: {
            category: surface.category,
            data: { HouseitKey: { value: surface.id } },
          },
        })
      }
      entry.surface = surface
      if (!old?.transform.equals(surface.transform)) {
        const e = surface.transform.elements
        requests.push({
          type: old ? Edit.UPDATE_GLOBAL_TRANSFORM : Edit.CREATE_GLOBAL_TRANSFORM,
          localId: entry.global,
          data: {
            itemId: entry.item,
            position: [e[12]!, e[13]!, e[14]!],
            xDirection: [e[0]!, e[1]!, e[2]!],
            yDirection: [e[4]!, e[5]!, e[6]!],
          },
        })
      }
      if (old && old.casts !== surface.casts)
        requests.push({
          type: Edit.UPDATE_SAMPLE,
          localId: entry.sample,
          data: {
            item: entry.global,
            representation: entry.representation,
            localTransform: 1,
            material: surface.casts ? 0 : 2,
          },
        })
      if (old?.geometry === surface.geometry) continue
      const geometry = surface.geometry.clone()
      if (!geometry.index)
        geometry.setIndex(
          Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i),
        )
      try {
        requests.push({
          type: old ? Edit.UPDATE_REPRESENTATION : Edit.CREATE_REPRESENTATION,
          localId: entry.representation,
          data: GeomsFbUtils.representationFromGeometry(geometry),
        })
        if (!old)
          requests.push({
            type: Edit.CREATE_SAMPLE,
            localId: entry.sample,
            data: {
              item: entry.global,
              representation: entry.representation,
              material: surface.casts ? 0 : 2,
              localTransform: 1,
            },
          })
      } finally {
        geometry.dispose()
      }
    }
    if (requests.length) {
      requests.push({ type: Edit.UPDATE_MAX_LOCAL_ID, localId: this.nextId })
      await this.fragments.core.editor.edit(this.id, requests)
      for (const model of this.fragments.list.values())
        if (model.modelId === this.id || model.parentModelId === this.id)
          await model.setLodMode(LodMode.ALL_VISIBLE)
      await this.fragments.core.update(true)
      this.error = null
      this.revision++
    }
    for (const model of this.fragments.list.values())
      if (model.modelId === this.id || model.parentModelId === this.id)
        for (const mesh of model.tiles.values()) this.prepare(model, mesh)
  }
  private prepare(model: FragmentsModel, object: Object3D) {
    if (!(object instanceof Mesh) || 'isLODGeometry' in object.geometry) return
    const geometry = object.geometry as BufferGeometry
    if (geometry.userData.houseitSurface) {
      styleFragmentTile(object)
      return
    }
    if (geometry.userData.houseitPending) return
    for (const attribute of Object.values(geometry.attributes))
      if ('onUpload' in attribute) attribute.onUpload(() => {})
    geometry.index?.onUpload(() => {})
    geometry.userData.houseitPending = true
    const ids = geometry.getAttribute('id')
    const itemIds = tileItemIds(ids)
    const unique = [...new Set(itemIds)]
    const work = Promise.all(unique.map((id) => model.getLocalIdsFromItemIds([id])))
      .then((localIds) => {
        if (this.dead || !model.tiles.has(object.userData.tileId)) return
        const entries = new Map([...this.entries.values()].map((entry) => [entry.item, entry]))
        const mapped = new Map(unique.map((id, i) => [id, entries.get(localIds[i]![0]!)]))
        const vertices = itemIds.map((id) => mapped.get(id))
        if (vertices.some((entry) => !entry))
          throw new Error('Native display tile contains an unknown element')
        mapFragmentTile(geometry, object.matrix, vertices as Entry[])
        const casts = new Set(vertices.map((entry) => entry!.surface.casts))
        if (casts.size !== 1) throw new Error('Native tile mixed incompatible shadow settings')
        object.castShadow = vertices[0]!.surface.casts
        object.receiveShadow = true
        styleFragmentTile(object)
      })
      .catch(this.fail)
      .finally(() => this.preparing.delete(work))
    this.preparing.add(work)
  }
  owner(object: Object3D, vertex?: number) {
    if (!(object instanceof Mesh) || vertex === undefined) return undefined
    return (object.geometry.userData.houseitSurface as Entry[] | undefined)?.[vertex]?.surface.id
  }
  async dispose() {
    this.dead = true
    await this.work
    await Promise.allSettled(this.preparing)
    await this.toolsDisposal
    this.surfaces.clear()
  }
}
