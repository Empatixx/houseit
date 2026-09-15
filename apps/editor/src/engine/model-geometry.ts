import { Box3, Group, Mesh, type Object3D, Vector3 } from 'three'

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

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
  const meshes: {
    id: string
    geometry: Mesh['geometry']
    original: Mesh['material']
    casts: boolean
    receives: boolean
  }[] = []
  stood.traverseVisible((node) => {
    if (node instanceof Mesh)
      meshes.push({
        id: node.uuid,
        geometry: node.geometry.clone().applyMatrix4(node.matrixWorld),
        original: node.material,
        casts: node.castShadow,
        receives: node.receiveShadow,
      })
  })
  return meshes
}
