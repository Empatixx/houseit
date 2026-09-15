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
  Mesh,
  type Object3D,
  type OrthographicCamera,
  type PerspectiveCamera,
} from 'three'
import type { Selection } from '../store/selection'
import { compactDisplayBuffer, stageDisplayEdit } from './display-edits'
import type { DisplaySurface } from './display-surface'
import { mapFragmentTile, styleFragmentTile, tileItemIds } from './fragment-tile'

type Entry = {
  surface: DisplaySurface
  item: number
  global: number
  representation: number
  sample: number
  material: number
}
const materialId = (surface: DisplaySurface) =>
  surface.receives === false ? (surface.casts ? 4 : 3) : surface.casts ? 0 : 2
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
  readonly gestures = new Set<string>()
  readonly transient = new Set<number>()
  private transparentMaterials = new Map<string, number>()
  private representations = new Map<string, { id: number; geometry: BufferGeometry }>()
  private entries = new Map<string, Entry>()
  private modelItems = new Map<string, Set<number>>()
  private nextId = 5
  private dirty = false
  private dead = false
  private loaded = false
  private work: Promise<void> | null = null
  private cameraKey = ''
  private preview = false
  private compact = false
  private compactAfter = 0
  pointerDown = false
  private queries = 0
  private retaining = new Set<Object3D>()
  private retired = new Map<number, EditRequest>()

  constructor(
    private camera: () => PerspectiveCamera | OrthographicCamera,
    private changed: () => void,
    private report: (error: unknown) => void,
  ) {
    const options = { classicWorker: false, maxWorkers: 2, threadGroups: { background: 1 } }
    this.fragments.init(workerUrl, options)
    this.fragments.core.settings.autoCoordinate = false
    this.fragments.core.settings.maxUpdateRate = 0
    this.fragments.core.settings.meshConnectionRate = 0
    this.fragments.core.settings.meshConnectionThreshold = 1
    this.fragments.core.settings.threadUpdaterDelay = 32
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
      this.modelItems.delete(id)
      for (const root of this.roots)
        if (root.name === id && !this.retaining.has(root)) this.roots.delete(root)
      this.changed()
    })
  }

  private fail = (error: unknown) => {
    if (this.dead) return
    this.error = error instanceof Error ? error.message : String(error)
    this.report(error)
  }
  get busy() {
    return this.dirty || !!this.work || this.preparing.size > 0 || (this.compact && !this.preview)
  }
  async query<T>(read: () => Promise<T>): Promise<T> {
    this.queries++
    try {
      await this.work
      while (this.preparing.size) await Promise.allSettled(this.preparing)
      return await read()
    } finally {
      this.queries--
    }
  }
  get previewing() {
    return this.preview
  }
  get canSnap() {
    return (
      this.loaded &&
      !this.error &&
      !this.work &&
      this.preparing.size === 0 &&
      (!this.dirty || this.gestures.size > 0 || this.preview)
    )
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
    return Object.fromEntries(
      [...this.modelItems].flatMap(([modelId, items]) => {
        const selected = ids.filter((id) => items.has(id))
        return selected.length ? [[modelId, new Set(selected)]] : []
      }),
    )
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
    if (this.preview && !preview) this.compactAfter = performance.now() + 250
    if (this.preview !== preview) this.transient.clear()
    this.preview = preview
    this.fragments.core.settings.threadUpdaterDelay = preview ? 0 : 32
    if (this.dead) return
    const camera = this.camera()
    const key = `${camera.uuid}:${camera.matrixWorld.elements}:${camera.projectionMatrix.elements}`
    if (key !== this.cameraKey && !this.work) {
      this.cameraKey = key
      for (const model of this.fragments.list.values()) model.useCamera.bind(model)(camera)
      void this.fragments.core.update().catch(this.fail)
    }
    if (
      (this.dirty || (this.compact && !preview && performance.now() >= this.compactAfter)) &&
      !this.work &&
      this.preparing.size === 0 &&
      this.queries === 0
    ) {
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
          ...[3, 4].map((localId) => ({
            type: Edit.CREATE_MATERIAL as const,
            localId,
            data: { r: 247 - localId, g: 247, b: 245, a: 255, renderedFaces: 0, stroke: 0 },
          })),
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
          representation: -1,
          sample: this.nextId++,
          material: -1,
        }
        this.entries.set(surface.id, entry)
      }
      if (surface.owner) this.owners.set(entry.item, surface.owner)
      else this.owners.delete(entry.item)
      if (!old || old.entity !== surface.entity || old.category !== surface.category)
        requests.push({
          type: old ? Edit.UPDATE_ITEM : Edit.CREATE_ITEM,
          localId: entry.item,
          data: {
            category: surface.category,
            data: {
              HouseitKey: { value: surface.id },
              HouseitEntityKey: { value: surface.entity ?? '' },
            },
          },
        })
      if (
        this.preview &&
        (!old || old.geometry !== surface.geometry || !old.transform.equals(surface.transform))
      )
        this.transient.add(entry.item)
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
      const key = surface.geometryKey ?? surface.id
      let representation = this.representations.get(key)
      if (representation && !surface.geometryKey && representation.geometry !== surface.geometry) {
        requests.push({ type: Edit.DELETE_REPRESENTATION, localId: representation.id })
        representation = undefined
      }
      const create = !representation
      if (!representation) {
        representation = { id: this.nextId++, geometry: surface.geometry }
        this.representations.set(key, representation)
      }
      if (create) {
        const geometry = surface.geometry.clone()
        if (!geometry.index)
          geometry.setIndex(
            Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i),
          )
        try {
          requests.push({
            type: Edit.CREATE_REPRESENTATION,
            localId: representation.id,
            data: GeomsFbUtils.representationFromGeometry(
              geometry,
              undefined,
              surface.mapping.kind === 'source'
                ? {
                    threshold: 0,
                    precision: 1e6,
                    normalPrecision: 1e7,
                    planePrecision: 1e3,
                    faceThreshold: 0.6,
                    forceTransparentSpaces: true,
                  }
                : undefined,
            ),
          })
          representation.geometry = surface.geometry
        } finally {
          geometry.dispose()
        }
      }
      let material = materialId(surface)
      if (surface.materials.some((value) => value.transparent)) {
        let dedicated = this.transparentMaterials.get(surface.id)
        if (dedicated === undefined) {
          dedicated = this.nextId++
          this.transparentMaterials.set(surface.id, dedicated)
          requests.push({
            type: Edit.CREATE_MATERIAL,
            localId: dedicated,
            data: {
              r: dedicated % 256,
              g: Math.floor(dedicated / 256) % 256,
              b: Math.floor(dedicated / 65536) % 256,
              a: 255,
              renderedFaces: 0,
              stroke: 0,
            },
          })
        }
        material = dedicated
      }
      if (!old || entry.material !== material || entry.representation !== representation.id) {
        entry.material = material
        entry.representation = representation.id
        requests.push({
          type: old ? Edit.UPDATE_SAMPLE : Edit.CREATE_SAMPLE,
          localId: entry.sample,
          data: {
            item: entry.global,
            representation: entry.representation,
            material,
            localTransform: 1,
          },
        })
      }
    }
    const used = new Set(
      [...this.surfaces.values()].map((surface) => surface.geometryKey ?? surface.id),
    )
    for (const [key, representation] of this.representations)
      if (!used.has(key)) {
        requests.push({ type: Edit.DELETE_REPRESENTATION, localId: representation.id })
        this.representations.delete(key)
      }
    for (const [id, material] of this.transparentMaterials) {
      if (this.surfaces.get(id)?.materials.some((value) => value.transparent)) continue
      requests.push({ type: Edit.DELETE_MATERIAL, localId: material })
      this.transparentMaterials.delete(id)
    }
    if (requests.length) {
      requests.push({ type: Edit.UPDATE_MAX_LOCAL_ID, localId: this.nextId })
      await this.fragments.core.editor.edit(this.id, stageDisplayEdit(requests, this.retired))
      for (const model of this.fragments.list.values())
        if (model.modelId === this.id || model.parentModelId === this.id)
          await model.setLodMode(LodMode.ALL_VISIBLE)
      await this.fragments.core.update(true)
      this.error = null
      this.revision++
    }
    if (requests.length) {
      this.compact = true
      this.compactAfter = performance.now() + 250
    }
    if (this.compact && !this.preview && performance.now() >= this.compactAfter) {
      this.compact = false
      await Promise.allSettled(this.preparing)
      const previous = this.fragments.list.get(this.id)!
      const { requests } = await this.fragments.core.editor.getModelRequests(this.id)
      const buffer = compactDisplayBuffer(
        new Uint8Array(await previous.getBuffer(true)),
        requests,
        this.retired.values(),
        this.nextId,
      )
      this.retaining.add(previous.object)
      await previous.dispose({ keepInScene: true })
      await this.fragments.core.load(buffer, { modelId: this.id, raw: true, camera: this.camera() })
      await this.fragments.list.get(this.id)?.setLodMode(LodMode.ALL_VISIBLE)
      await this.fragments.core.update(true)
      await Promise.allSettled(this.preparing)
      await this.fragments.core.editor.reset(this.id)
      this.retaining.delete(previous.object)
      this.roots.delete(previous.object)
      previous.finalizeDispose()
      this.retired.clear()
      this.changed()
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
        const items = this.modelItems.get(model.modelId) ?? new Set<number>()
        for (const ids of localIds) for (const id of ids) items.add(id)
        this.modelItems.set(model.modelId, items)
        const entries = new Map([...this.entries.values()].map((entry) => [entry.item, entry]))
        const mapped = new Map(unique.map((id, i) => [id, entries.get(localIds[i]![0]!)]))
        const vertices = itemIds.map((id) => mapped.get(id))
        if (vertices.some((entry) => !entry))
          throw new Error('Native display tile contains an unknown element')
        mapFragmentTile(geometry, object.matrix, vertices as Entry[])
        const settings = new Set(vertices.map((entry) => materialId(entry!.surface)))
        if (settings.size !== 1) throw new Error('Native tile mixed incompatible shadow settings')
        object.castShadow = vertices[0]!.surface.casts
        object.receiveShadow = vertices[0]!.surface.receives !== false
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
