import {
  Box3,
  BufferAttribute,
  type BufferGeometry,
  Group,
  type Material,
  Mesh,
  type Object3D,
  Vector3,
} from 'three'

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const KEPT = ['position', 'normal', 'uv'] as const

const models = new Map<string, ReturnType<GLTFLoader['loadAsync']>>()
export function loadModel(file: string) {
  const cached = models.get(file)
  if (cached) return cached
  const result = new GLTFLoader().loadAsync(`/models/${file}`)
  models.set(file, result)
  void result.catch(() => models.delete(file))
  return result
}

export function modelGeometry(
  scene: Object3D,
  size: { width: number; height: number; depth: number },
) {
  const model = scene.clone(true)
  const box = new Box3().setFromObject(model)
  const measured = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  model.position.set(-centre.x, -box.min.y, -centre.z)
  const stood = new Group()
  stood.add(model)
  stood.scale.set(
    measured.x === 0 ? 1 : size.width / 1000 / measured.x,
    measured.y === 0 ? 1 : size.height / 1000 / measured.y,
    measured.z === 0 ? 1 : size.depth / 1000 / measured.z,
  )
  stood.position.y = -size.height / 2000
  stood.updateMatrixWorld(true)
  const byMaterial = new Map<Material, { geometries: BufferGeometry[]; first: string }>()
  stood.traverseVisible((node) => {
    if (!(node instanceof Mesh) || Array.isArray(node.material)) return
    const placed = node.geometry.clone().applyMatrix4(node.matrixWorld)
    const found = byMaterial.get(node.material)
    if (found) found.geometries.push(placed)
    else byMaterial.set(node.material, { geometries: [placed], first: node.uuid })
  })
  return [...byMaterial].map(([material, { geometries, first }]) => ({
    id: first,
    geometry: merged(geometries),
    original: material as Mesh['material'],
    casts: true,
    receives: true,
  }))
}

function merged(geometries: BufferGeometry[]) {
  if (geometries.length === 1) return geometries[0]!
  const indexed = geometries.every((geometry) => geometry.index)
  const plain = geometries.map((geometry) => {
    const flat = indexed || !geometry.index ? geometry : geometry.toNonIndexed()
    const count = flat.getAttribute('position').count
    for (const name of Object.keys(flat.attributes))
      if (!KEPT.includes(name as (typeof KEPT)[number])) flat.deleteAttribute(name)
    if (!flat.getAttribute('uv'))
      flat.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2))
    flat.clearGroups()
    return flat
  })
  const joined = mergeGeometries(plain)
  for (const geometry of new Set([...geometries, ...plain])) geometry.dispose()
  if (!joined) throw new Error('model parts could not be merged')
  return joined
}
