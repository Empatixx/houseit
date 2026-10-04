// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs'
import { heightOf } from '@houseit/core/heights'
import { modelFileOf } from '@houseit/core/imported'
import { OBJECT_TYPES } from '@houseit/core/object-types'
import { Box3, DataTexture, Mesh, Vector3 } from 'three'
import { type GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, test } from 'vitest'

const MODELS = new URL('../../public/models/', import.meta.url)
const STRETCH = 1.1

const placed = OBJECT_TYPES.flatMap((type) => {
  const file = modelFileOf(type.id)
  return file
    ? [
        {
          id: type.id,
          file,
          width: type.size.width,
          depth: type.size.depth,
          height: heightOf(type.id).height,
        },
      ]
    : []
})
const files = [...new Set(placed.map((entry) => entry.file))]

const loaded = new Map<string, Promise<{ gltf: GLTF; json: GltfJson }>>()
function load(file: string) {
  const known = loaded.get(file)
  if (known) return known
  const bytes = readFileSync(new URL(file, MODELS))
  const length = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')) as GltfJson
  const loader = new GLTFLoader().register(() => ({
    name: 'node-placeholder-images',
    loadTexture: async () => new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
  }))
  const result = loader
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    .then((gltf) => ({ gltf, json }))
  loaded.set(file, result)
  return result
}

type GltfJson = {
  nodes?: { name?: string; mesh?: number }[]
  meshes?: { primitives: { attributes: Record<string, number> }[] }[]
  materials?: { name?: string; doubleSided?: boolean }[]
}

test('every model file is placed by some catalogue type', () => {
  const present = readdirSync(MODELS).filter((name) => name.endsWith('.glb'))
  expect(present.filter((name) => !files.includes(name))).toEqual([])
})

describe.each(files)('%s', (file) => {
  test('keeps its parts as separate named meshes', async () => {
    const { json } = await load(file)
    const parts = (json.nodes ?? []).filter((node) => node.mesh !== undefined)
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) {
      expect(part.name).toMatch(/^[A-Z]/)
      expect(part.name).not.toMatch(/^(Cube|Cylinder|Sphere|Plane|Cone|Torus|Mesh)\b/)
    }
  })

  test('carries one texture coordinate set and closes its solids', async () => {
    const { json } = await load(file)
    for (const mesh of json.meshes ?? [])
      for (const primitive of mesh.primitives)
        expect(Object.keys(primitive.attributes)).not.toContain('TEXCOORD_1')
    const materials = json.materials ?? []
    expect(materials.filter((material) => !material.doubleSided).length).toBeGreaterThan(0)
  })
})

describe.each(placed)('$id', ({ file, width, depth, height }) => {
  test('is modelled at the size the catalogue declares', async () => {
    const { gltf } = await load(file)
    gltf.scene.updateMatrixWorld(true)
    const box = new Box3()
    gltf.scene.traverse((node) => {
      if (node instanceof Mesh) box.expandByObject(node)
    })
    const size = box.getSize(new Vector3())
    const scales = [width / 1000 / size.x, height / 1000 / size.y, depth / 1000 / size.z]
    expect(Math.max(...scales) / Math.min(...scales)).toBeLessThanOrEqual(STRETCH)
  })
})
