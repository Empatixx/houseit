// @vitest-environment node

import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import { GeometryEngine } from '@thatopen/fragments'
import { Box3, DataTexture, Mesh, type MeshStandardMaterial, PointLight } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { IfcAPI } from 'web-ifc'
import { FragmentAuthoring } from './fragment-authoring'

import { generateGeometry } from './generate-geometry'
import type { GeometryInput } from './geometry-protocol'

vi.mock('./model-geometry', async (original) => ({
  ...(await original<typeof import('./model-geometry')>()),
  loadModel: async (file: string) => {
    const bytes = readFileSync(new URL(`../../public/models/${file}`, import.meta.url))
    const loader = new GLTFLoader().register(() => ({
      name: 'node-placeholder-images',
      loadTexture: async () => new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
    }))
    return loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  },
}))

vi.mock('./geometry-session', () => ({
  acquireGeometry: () => ({
    engine: { geometry: (input: GeometryInput) => generate(input) },
    release: () => {},
  }),
}))

vi.setConfig({ testTimeout: 30000 })

const api = new IfcAPI()
let engine: GeometryEngine
beforeAll(async () => {
  await api.Init(undefined, true)
  engine = new GeometryEngine(api)
})
afterAll(() => api.Dispose())

const generate = async (input: GeometryInput) => {
  const geometry = generateGeometry(engine, input)
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

import { houseScene } from './house-export'

test('the exported house is storeys of named elements, furniture in its own parts', async () => {
  const authoring = new FragmentAuthoring(createEmptyDocument())
  const level = Object.keys(authoring.document.levels)[0]!
  try {
    authoring.exec(
      `add-room --name Studio --shape rectangle --width 5m --depth 4m --material concrete-light
add-opening --room Studio --side south --kind window --width 1200
add-object --room Studio --type sofa-3 --against north --surface grey`,
      level,
    )
    const doc = authoring.document
    const scene = await houseScene(doc, generate)
    expect(scene.getObjectByName('Terrain')).toBeUndefined()
    const storey = scene.children.find((child) => child.name === doc.levels[level]!.name)!
    expect(storey).toBeDefined()
    const elements = storey.children.map((child) => [child.name, child.userData.ifc])
    expect(elements).toContainEqual(['Studio floor', 'IFCCOVERING'])
    expect(elements.filter(([, ifc]) => ifc === 'IFCWALL').length).toBeGreaterThanOrEqual(4)
    expect(elements.some(([name, ifc]) => /^Window /.test(name) && ifc === 'IFCWINDOW')).toBe(true)
    const sofa = storey.children.find((child) => child.name.startsWith('3-Seat Sofa'))!
    expect(sofa.userData).toMatchObject({ ifc: 'IFCFURNISHINGELEMENT' })
    const parts: string[] = []
    sofa.traverse((node) => {
      if (node instanceof Mesh) parts.push(node.name)
    })
    expect(parts.length).toBeGreaterThan(10)
    expect(parts).toContain('Upholstered base')
    let body: MeshStandardMaterial | undefined
    sofa.traverse((node) => {
      if (node instanceof Mesh && node.material.name === 'body') body = node.material
    })
    expect(body?.color.getHexString()).not.toBe('ffffff')
    const lights: PointLight[] = []
    storey.traverse((node) => {
      if (node instanceof PointLight) lights.push(node)
    })
    expect(lights.length).toBeGreaterThan(0)
    expect(lights.every((light) => light.intensity > 0 && light.position.y > 2)).toBe(true)
    expect(elements.some(([, ifc]) => ifc === 'IFCLIGHTFIXTURE')).toBe(true)
    const bounds = new Box3().setFromObject(sofa)
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.85, 2)
  } finally {
    authoring.dispose()
  }
})
