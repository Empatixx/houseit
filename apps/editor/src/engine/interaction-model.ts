import type { FragmentsManager, ModelIdMap } from '@thatopen/components'
import { EditUtils } from '@thatopen/fragments'
import {
  BufferGeometry,
  type Material,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Selection } from '../store/selection'

type Item = { owner: Selection; signature: string; geometries: BufferGeometry[] }
const keyOf = (owner: Selection) => `${owner.kind}:${owner.id}`

export class InteractionModel {
  readonly id = 'houseit-interaction'
  readonly owners = new Map<number, Selection>()
  private items = new Map<string, { localId: number; signature: string }>()
  private loaded = false
  private sceneSignature = ''
  constructor(private fragments: FragmentsManager) {}
  get model() {
    return this.fragments.list.get(this.id)
  }
  ids(owner: Selection): ModelIdMap {
    const item = this.items.get(keyOf(owner))
    return item ? { [this.id]: new Set([item.localId]) } : {}
  }
  async sync(scene: Object3D) {
    scene.updateMatrixWorld(true)
    let signature = ''
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      let node: Object3D | null = object
      let owner: Selection | undefined
      while (node) {
        if (!node.visible || node.userData.houseitHelper || node.userData.houseitNative) return
        owner ??= node.userData.houseit
        node = node.parent
      }
      if (owner)
        signature += `${keyOf(owner)}:${sourceGeometry(object).uuid}:${object.matrixWorld.elements};`
    })
    if (this.loaded && signature === this.sceneSignature) return false
    const entries = new Map<string, Item>()
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || !object.visible) return
      let node: Object3D | null = object
      let owner: Selection | undefined
      while (node) {
        if (!node.visible || node.userData.houseitHelper || node.userData.houseitNative) return
        owner ??= node.userData.houseit
        node = node.parent
      }
      const source = sourceGeometry(object)
      if (!owner || !source.getAttribute('position')) return
      const key = keyOf(owner)
      const item = entries.get(key) ?? { owner, signature: '', geometries: [] }
      item.signature += `${sourceGeometry(object).uuid}:${object.matrixWorld.elements.join(',')};`
      const geometry = source.index ? source.toNonIndexed() : source.clone()
      for (const name of Object.keys(geometry.attributes))
        if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
      geometry.applyMatrix4(object.matrixWorld)
      item.geometries.push(geometry)
      entries.set(key, item)
    })
    const { core } = this.fragments
    try {
      if (!this.loaded) {
        await core.load(EditUtils.newModel({ raw: true }), { modelId: this.id, raw: true })
        this.loaded = true
      }
      const removed = [...this.items].filter(([key]) => !entries.has(key))
      if (removed.length) {
        const elements = await core.editor.getElements(
          this.id,
          removed.map(([, item]) => item.localId),
        )
        core.editor.deleteElements(this.id, elements)
        await core.editor.applyChanges(this.id)
        for (const [key, item] of removed) {
          this.items.delete(key)
          this.owners.delete(item.localId)
        }
      }
      const changed = [...entries].filter(
        ([key, item]) => this.items.get(key)?.signature !== item.signature,
      )
      const material = new MeshLambertMaterial({ transparent: true, opacity: 0, depthWrite: false })
      const prepared = changed.map(([key, item]) => {
        const geometry = mergeGeometries(item.geometries)
        if (!geometry) throw new Error(`Cannot project ${key} into That Open`)
        geometry.setIndex(
          Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i),
        )
        return { key, item, geometry, old: this.items.get(key) }
      })
      try {
        const added = prepared.filter((entry) => !entry.old)
        if (added.length) {
          const created = await core.editor.createElements(
            this.id,
            added.map(({ key, item, geometry }) => ({
              attributes: {
                _category: {
                  value:
                    item.owner.kind === 'wall'
                      ? 'IFCWALL'
                      : item.owner.kind === 'room'
                        ? 'IFCSPACE'
                        : 'IFCBUILDINGELEMENTPROXY',
                },
                Name: { value: key },
              },
              globalTransform: new Matrix4(),
              samples: [{ localTransform: new Matrix4(), representation: geometry, material }],
            })),
          )
          if (created?.length !== added.length)
            throw new Error('Incomplete native interaction model')
          for (const [index, element] of created.entries()) {
            const { key, item } = added[index]!
            this.items.set(key, { localId: element.localId, signature: item.signature })
            this.owners.set(element.localId, item.owner)
          }
        }
        const edited = prepared.filter((entry) => entry.old)
        if (edited.length) {
          const elements = await core.editor.getElements(
            this.id,
            edited.map((entry) => entry.old!.localId),
          )
          for (const entry of edited) {
            const element = elements.find((element) => element.localId === entry.old!.localId)
            if (!element) throw new Error(`Missing native item ${entry.key}`)
            const meshes = await element.getMeshes()
            const previous: BufferGeometry[] = []
            const materials = new Set<Material>()
            meshes.traverse((object) => {
              if (!(object instanceof Mesh)) return
              previous.push(object.geometry)
              entry.geometry.userData.localId = object.geometry.userData.localId
              object.geometry = entry.geometry
              for (const material of Array.isArray(object.material)
                ? object.material
                : [object.material])
                materials.add(material)
            })
            try {
              await element.setMeshes(meshes)
            } finally {
              for (const geometry of previous) geometry.dispose()
              for (const material of materials) material.dispose()
            }
          }
          await core.editor.applyChanges(this.id, elements)
          for (const { key, old, item } of edited)
            this.items.set(key, { localId: old!.localId, signature: item.signature })
        }
        if (removed.length || changed.length) await core.editor.save(this.id)
      } finally {
        for (const entry of prepared) entry.geometry.dispose()
        material.dispose()
      }
      await core.update(true)
      this.sceneSignature = signature
      return removed.length > 0 || changed.length > 0
    } finally {
      for (const item of entries.values())
        for (const geometry of item.geometries) geometry.dispose()
    }
  }
}

function sourceGeometry(object: Mesh): BufferGeometry {
  return object.userData.houseitGeometry instanceof BufferGeometry
    ? object.userData.houseitGeometry
    : object.geometry
}
