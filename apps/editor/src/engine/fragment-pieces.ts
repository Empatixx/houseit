import type { HouseDocument } from '@houseit/core/document'
import type { Owner, Piece } from '@houseit/scene/pieces'
import { worldOf } from '@houseit/scene/world'
import { EditUtils, type FragmentsModels } from '@thatopen/fragments'
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { type GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { flatGeometry } from '../scene/three/flat-geometry'

const assets = new Map<string, Promise<GLTF>>()
const loader = new GLTFLoader()
const identity = () => new Matrix4()

type Sample = {
  localTransform: Matrix4
  representation: BufferGeometry
  material: MeshLambertMaterial
}

export class FragmentPieces {
  readonly modelId = 'houseit-interior'
  readonly owners = new Map<number, Owner>()
  private loaded = false
  constructor(private core: FragmentsModels) {}

  async update(doc: HouseDocument) {
    if (this.loaded) await this.core.disposeModel(this.modelId)
    this.owners.clear()
    this.loaded = false
    const world = worldOf(doc)
    const pieces = [
      ...world.site,
      ...world.storeys.flatMap((storey) =>
        storey.pieces
          .filter((piece) => piece.role !== 'wall-solid')
          .map((piece) => ({ ...piece, at: { ...piece.at, y: piece.at.y + storey.elevation } })),
      ),
    ]
    const groups = new Map<string, { owner?: Owner; samples: Sample[] }>()
    try {
      for (const piece of pieces) {
        if (piece.body.kind === 'symbol' || piece.paint.opacity === 0) continue
        const samples = await samplesOf(piece)
        const key = piece.of ? `${piece.of.kind}:${piece.of.id}` : 'site'
        const group = groups.get(key) ?? { owner: piece.of, samples: [] }
        group.samples.push(...samples)
        groups.set(key, group)
      }
      await this.core.load(EditUtils.newModel({ raw: true }), { modelId: this.modelId, raw: true })
      this.loaded = true
      const entries = [...groups]
      const elements = await this.core.editor.createElements(
        this.modelId,
        entries.map(([key, group]) => ({
          attributes: { Name: { value: key }, _category: { value: group.owner?.kind ?? 'site' } },
          globalTransform: identity(),
          samples: group.samples,
        })),
      )
      for (let i = 0; i < entries.length; i++) {
        const owner = entries[i]![1].owner
        if (owner && elements?.[i]) this.owners.set(elements[i]!.localId, owner)
      }
      await this.core.editor.save(this.modelId)
    } finally {
      for (const group of groups.values())
        for (const sample of group.samples) {
          sample.representation.dispose()
          sample.material.dispose()
        }
    }
  }
}

async function samplesOf(piece: Piece): Promise<Sample[]> {
  const { body, at, paint } = piece
  const position = new Vector3(at.x / 1000, at.y / 1000, at.z / 1000)
  const rotation = new Euler(piece.tilt ?? 0, piece.turn ?? 0, piece.roll ?? 0, 'YXZ')
  const scale = new Vector3(1, 1, 1)
  const material = () =>
    new MeshLambertMaterial({
      color: paint.colour,
      opacity: paint.opacity ?? 1,
      transparent: (paint.opacity ?? 1) < 1,
      side: DoubleSide,
    })
  if (body.kind === 'model') {
    let request = assets.get(body.file)
    if (!request) {
      request = loader.loadAsync(`/models/${body.file}`)
      assets.set(body.file, request)
    }
    const { scene } = await request
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(scene),
      size = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3())
    const transform = new Matrix4()
      .compose(position, new Quaternion().setFromEuler(rotation), scale)
      .multiply(new Matrix4().makeTranslation(0, -body.height / 2000, 0))
      .multiply(
        new Matrix4().makeScale(
          body.width / 1000 / (size.x || 1),
          body.height / 1000 / (size.y || 1),
          body.depth / 1000 / (size.z || 1),
        ),
      )
      .multiply(new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z))
    const samples: Sample[] = []
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return
      const geometry = normalized(
        node.geometry.clone().applyMatrix4(transform.clone().multiply(node.matrixWorld)),
      )
      const source = Array.isArray(node.material) ? node.material[0] : node.material
      const m = material()
      if (source && 'color' in source && !/^(body)?$/.test(source.name)) m.color.copy(source.color)
      samples.push({ localTransform: identity(), representation: geometry, material: m })
    })
    return samples
  }
  let geometry: BufferGeometry
  switch (body.kind) {
    case 'box':
      geometry = body.faces
        ? new BufferGeometry().setAttribute(
            'position',
            new Float32BufferAttribute(
              body.faces.map((v) => v / 1000),
              3,
            ),
          )
        : new BoxGeometry(body.width / 1000, body.height / 1000, body.depth / 1000)
      break
    case 'drum':
      geometry = new CylinderGeometry(
        body.top / 1000,
        body.radius / 1000,
        body.height / 1000,
        28,
        1,
        body.open,
      )
      scale.z = body.stretch
      break
    case 'ball':
      geometry = new SphereGeometry(body.radius / 1000, 18, 14)
      break
    case 'prism':
    case 'sheet':
      geometry = flatGeometry(body)
      rotation.x -= Math.PI / 2
      if (body.kind === 'prism') position.y -= body.thickness / 2000
      break
    default:
      return []
  }
  geometry.applyMatrix4(
    new Matrix4().compose(position, new Quaternion().setFromEuler(rotation), scale),
  )
  return [
    { localTransform: identity(), representation: normalized(geometry), material: material() },
  ]
}

function normalized(geometry: BufferGeometry) {
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  if (!geometry.getIndex())
    geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i))
  return geometry
}
