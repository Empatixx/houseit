import type { HouseDocument } from '@houseit/core/document'
import { objectType } from '@houseit/core/object-types'
import type { Finish, Piece } from '@houseit/scene/pieces'
import {
  type BufferGeometry,
  DoubleSide,
  FrontSide,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { type ArchivePaint, archiveScene, type GenerateGeometry } from './archive-scene'
import { loadModel, standModel } from './model-geometry'

const OWNER = /(rooms|walls|objects|openings|levels|elements):([^:]+)$/
const WORDS: Record<string, string> = {
  IFCWALL: 'wall',
  IFCSLAB: 'slab',
  IFCCOVERING: 'floor',
  IFCSTAIR: 'stair',
  IFCRAMP: 'ramp',
  IFCROOF: 'roof',
  IFCCOLUMN: 'column',
  IFCRAILING: 'railing',
  IFCDOOR: 'door',
  IFCWINDOW: 'window',
}

export async function exportHouse(doc: HouseDocument, generate?: GenerateGeometry) {
  const session = generate ? undefined : (await import('./geometry-session')).acquireGeometry()
  try {
    const scene = await houseScene(doc, generate ?? ((input) => session!.engine.geometry(input)))
    return (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer
  } finally {
    session?.release()
  }
}

export async function houseScene(doc: HouseDocument, generate: GenerateGeometry) {
  const scene = new Scene()
  scene.name = 'Houseit house'
  const storeys = new Map<string, Group>()
  const elements = new Map<string, Group>()
  const placed = new Set<string>()
  const textures = new Map<string, Promise<Texture | undefined>>()
  const materials = new Map<string, Promise<Material>>()

  const storeyOf = (level: string | undefined) => {
    const key = level ?? 'site'
    let group = storeys.get(key)
    if (!group) {
      group = new Group()
      group.name = level ? (doc.levels[level]?.name ?? level) : 'Site'
      group.userData = { houseit: level ? `levels:${level}` : 'site' }
      storeys.set(key, group)
      scene.add(group)
    }
    return group
  }

  const elementOf = (entity: string, category: string | undefined, level: string | undefined) => {
    const key = `${level ?? 'site'}|${entity}`
    let group = elements.get(key)
    if (!group) {
      group = new Group()
      group.name = labelOf(doc, entity, category)
      group.userData = { houseit: entity, ...(category ? { ifc: category } : {}) }
      elements.set(key, group)
      storeyOf(level).add(group)
    }
    return group
  }

  const textureOf = (path: string) => {
    let found = textures.get(path)
    if (!found) {
      found = new TextureLoader()
        .loadAsync(path.startsWith('/') ? path : `/textures/${path}`)
        .catch(() => undefined)
      textures.set(path, found)
    }
    return found
  }

  const paintOf = (paint: ArchivePaint) => {
    const key = JSON.stringify({ ...paint, imported: undefined })
    let found = materials.get(key)
    if (!found) {
      found = (async () => {
        const opacity = paint.opacity ?? 1
        const made = new MeshStandardMaterial({
          name: paint.texture ?? paint.colour,
          color: paint.nativeColour ?? paint.colour,
          roughness: paint.roughness ?? 0.9,
          metalness: 0,
          transparent: opacity < 1,
          opacity,
          vertexColors: paint.vertexColors ?? false,
          side: paint.doubleSided ? DoubleSide : FrontSide,
        })
        if (paint.texture && !paint.texture.startsWith('houseit:')) {
          const texture = await textureOf(paint.texture)
          if (texture) {
            const map = texture.clone()
            map.wrapS = RepeatWrapping
            map.wrapT = RepeatWrapping
            map.colorSpace = SRGBColorSpace
            if (paint.repeat) map.repeat.set(paint.repeat.x, paint.repeat.y)
            made.map = map
          }
        }
        return made
      })()
      materials.set(key, found)
    }
    return found
  }

  for await (const part of archiveScene(doc, generate)) {
    if (
      part.id === 'terrain:ground' ||
      !part.geometry.getAttribute('position').count ||
      part.paints.every((paint) => paint.opacity === 0 || paint.symbol)
    )
      continue
    const level = levelOf(doc, part.id)
    const element = elementOf(part.entity, part.category, level)
    const piece = part.piece
    if (piece?.body.kind === 'model') {
      const key = part.id.replace(/:\d+$/, '')
      if (placed.has(key)) continue
      placed.add(key)
      const model = await furnished(piece, piece.body)
      model.applyMatrix4(part.transform)
      element.add(model)
      continue
    }
    const painted = await Promise.all(part.paints.map(paintOf))
    const mesh = new Mesh(part.geometry, painted.length === 1 ? painted[0] : painted)
    mesh.name = part.id.slice(part.id.indexOf(':') + 1)
    mesh.applyMatrix4(part.transform)
    element.add(mesh)
  }
  return scene
}

async function furnished(
  piece: Piece,
  body: { file: string; width: number; height: number; depth: number },
) {
  const gltf = await loadModel(body.file)
  const stood = standModel(gltf.scene, body)
  const model = new Group()
  model.name = body.file.replace(/\.glb$/, '')
  const worn = new Map<Material, Material>()
  stood.traverseVisible((node) => {
    if (!(node instanceof Mesh) || Array.isArray(node.material)) return
    const geometry = (node.geometry as BufferGeometry).clone().applyMatrix4(node.matrixWorld)
    const part = new Mesh(geometry, wear(node.material, piece.paint, worn))
    part.name = nameOf(node)
    model.add(part)
  })
  return model
}

function nameOf(node: Object3D) {
  for (let at: Object3D | null = node; at; at = at.parent)
    if (typeof at.userData.name === 'string') return at.userData.name as string
  return node.name
}

function wear(original: Material, paint: Finish, worn: Map<Material, Material>) {
  if (!(original instanceof MeshStandardMaterial) || !/^(body)?$/.test(original.name))
    return original
  let painted = worn.get(original)
  if (!painted) {
    const copy = original.clone()
    copy.color.set(paint.colour)
    painted = copy
    worn.set(original, painted)
  }
  return painted
}

function levelOf(doc: HouseDocument, id: string) {
  if (id.startsWith('wall:')) return doc.walls[id.slice(5)]?.level
  const prefix = id.slice(0, id.indexOf(':'))
  return doc.levels[prefix] ? prefix : undefined
}

function labelOf(doc: HouseDocument, entity: string, category: string | undefined) {
  const word = category ? (WORDS[category] ?? 'element') : 'element'
  const owner = OWNER.exec(
    entity.startsWith('geometry:') ? (JSON.parse(entity.slice(9)) as string[])[1]! : entity,
  )
  if (!owner) return entity === 'terrain' ? 'Terrain' : `${capital(word)} ${entity}`
  const [, kind, id] = owner as unknown as [string, string, string]
  if (kind === 'objects') {
    const thing = doc.objects[id]
    return `${thing ? (objectType(thing.type)?.label ?? thing.type) : 'Object'} ${id}`
  }
  if (kind === 'rooms') return `${doc.rooms[id]?.name ?? id} ${word}`
  if (kind === 'openings') return `${capital(doc.openings[id]?.kind ?? word)} ${id}`
  if (kind === 'walls' || kind === 'elements') return `Wall ${id}`
  return `${capital(word)} ${doc.levels[id]?.name ?? id}`
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
