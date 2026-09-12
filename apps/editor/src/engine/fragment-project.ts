import { type HouseDocument, parseDocument } from '@houseit/core/document'
import { elementId } from '@houseit/geometry/wall-elements'
import {
  EditRequestType,
  EditUtils,
  type Element,
  type FragmentsModel,
  FragmentsModels,
} from '@thatopen/fragments'
import workerUrl from '@thatopen/fragments/worker?url'
import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshLambertMaterial } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { acquireGeometry } from './geometry-session'
import { wallBody } from './wall-body'

type Authoring = { schema: 1; document: HouseDocument; wallItems: Record<string, number> }
export type FragmentArchive = { format: 'houseit-fragments'; version: 1; buffer: ArrayBuffer }

export class FragmentProject {
  private fragments: FragmentsModels
  private ownsFragments: boolean
  private geometry = acquireGeometry()
  private items: Record<string, number> = {}
  private signatures = new Map<string, string>()
  private loaded = false
  private dead = false
  private modelId = 'houseit'

  constructor(fragments?: FragmentsModels) {
    this.ownsFragments = !fragments
    this.fragments = fragments ?? new FragmentsModels(workerUrl, { maxWorkers: 2 })
    this.fragments.settings.autoCoordinate = false
  }

  get model(): FragmentsModel {
    const model = this.fragments.models.list.get(this.modelId)
    if (!model) throw new Error('Fragment model is not loaded')
    return model
  }

  get status() {
    return { backend: '@thatopen/fragments', walls: { ...this.items }, loaded: this.loaded }
  }

  async load(buffer: ArrayBuffer): Promise<HouseDocument> {
    await this.fragments.load(buffer.slice(0), { modelId: this.modelId })
    this.loaded = true
    const metadata = await this.model.getMetadata<{ houseit?: Authoring }>()
    if (metadata.houseit?.schema !== 1)
      throw new Error('This Fragment model has no Houseit authoring data')
    const doc = parseDocument(metadata.houseit.document)
    this.items = metadata.houseit.wallItems
    const ids = new Set(await this.model.getItemsIdsWithGeometry())
    for (const [id, signature] of this.describe(doc)) {
      if (!ids.has(this.items[id]!)) throw new Error(`Fragment geometry for wall ${id} is missing`)
      this.signatures.set(id, signature)
    }
    if (Object.keys(this.items).length !== this.signatures.size)
      throw new Error('Fragment walls and authoring data disagree')
    return doc
  }

  async save(doc: HouseDocument): Promise<FragmentArchive> {
    if (this.dead) throw new Error('Fragment project is disposed')
    if (!this.loaded) {
      await this.fragments.load(EditUtils.newModel({ raw: true }), {
        modelId: this.modelId,
        raw: true,
      })
      this.loaded = true
    }
    const next = this.describe(doc)
    const editor = this.fragments.editor
    const removed = Object.keys(this.items).filter((id) => !next.has(id))
    if (removed.length) {
      const elements = await editor.getElements(
        this.modelId,
        removed.map((id) => this.items[id]!),
      )
      editor.deleteElements(this.modelId, elements)
      await editor.applyChanges(this.modelId)
      for (const id of removed) delete this.items[id]
    }
    for (const [id, signature] of next) {
      if (this.signatures.get(id) === signature) continue
      const geometry = await this.wallGeometry(doc, id)
      try {
        if (this.items[id] === undefined) {
          const material = new MeshLambertMaterial({ color: '#f1f0ed' })
          try {
            const made = await editor.createElements(this.modelId, [
              {
                attributes: {
                  _category: { value: 'IFCWALL' },
                  Name: { value: id },
                  HouseitWallId: { value: id },
                },
                globalTransform: new Matrix4(),
                samples: [{ localTransform: new Matrix4(), representation: geometry, material }],
              },
            ])
            if (!made?.[0]) throw new Error(`Fragment wall ${id} was not created`)
            this.items[id] = made[0].localId
          } finally {
            material.dispose()
          }
        } else {
          const [element] = await editor.getElements(this.modelId, [this.items[id]!])
          if (!element) throw new Error(`Fragment wall ${id} was not found`)
          await this.replaceGeometry(element, geometry)
          await editor.applyChanges(this.modelId, [element])
        }
      } finally {
        geometry.dispose()
      }
    }
    await editor.edit(this.modelId, [
      {
        type: EditRequestType.UPDATE_METADATA,
        localId: 0,
        data: { houseit: { schema: 1, document: doc, wallItems: this.items } satisfies Authoring },
      },
    ])
    await editor.save(this.modelId)
    const buffer = new Uint8Array(await this.model.getBuffer(false)).slice().buffer
    this.signatures = next
    return { format: 'houseit-fragments', version: 1, buffer }
  }

  async dispose() {
    if (this.dead) return
    this.dead = true
    try {
      if (this.ownsFragments) await this.fragments.dispose()
      else if (this.loaded) await this.fragments.disposeModel(this.modelId)
    } finally {
      this.geometry.release()
    }
  }

  private describe(doc: HouseDocument) {
    const entries = new Map<string, unknown[]>()
    for (const wall of Object.values(doc.walls)) {
      const id = elementId(wall),
        list = entries.get(id) ?? []
      list.push([
        wall,
        doc.nodes[wall.a],
        doc.nodes[wall.b],
        doc.levels[wall.level]!.elevation,
        wallBody(doc, wall),
      ])
      entries.set(id, list)
    }
    return new Map([...entries].map(([id, list]) => [id, JSON.stringify(list)]))
  }

  private async wallGeometry(doc: HouseDocument, id: string) {
    const parts: BufferGeometry[] = []
    try {
      for (const wall of Object.values(doc.walls).filter((w) => elementId(w) === id)) {
        const data = await this.geometry.engine.wall(wallBody(doc, wall))
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

  private async replaceGeometry(element: Element, geometry: BufferGeometry) {
    const meshes = await element.getMeshes()
    try {
      meshes.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.setAttribute('position', geometry.getAttribute('position'))
          object.geometry.setAttribute('normal', geometry.getAttribute('normal'))
          object.geometry.setIndex(geometry.getIndex())
        }
      })
      await element.setMeshes(meshes)
    } finally {
      element.disposeMeshes(meshes)
    }
  }
}
