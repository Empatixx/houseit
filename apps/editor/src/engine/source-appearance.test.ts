import {
  BoxGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { describe, expect, it } from 'vitest'
import type { TileSurface } from './display-surface'
import { mapFragmentTile } from './fragment-tile'

describe('Furniture appearance on native triangles', () => {
  it.each([
    ['box face seams', () => new BoxGeometry(1.4, 0.9, 0.65)],
    ['cylinder UV seam', () => new CylinderGeometry(0.3, 0.5, 1.2, 28)],
    ['sphere poles and smooth normals', () => new SphereGeometry(0.6, 18, 14)],
    [
      'terrain vertex colours',
      () => {
        const geometry = new PlaneGeometry(400, 400, 8, 8)
        geometry.setAttribute(
          'color',
          new Float32BufferAttribute(
            Array.from(
              { length: geometry.getAttribute('position').count * 3 },
              (_, i) => 0.7 + (i % 17) / 20,
            ),
            3,
          ),
        )
        return geometry
      },
    ],
  ] as const)('preserves %s after rotation, elevation and tile relocation', (_, make) => {
    const source = make()
    const transform = new Matrix4()
      .makeRotationFromEuler(new Euler(0.2, 0.37, -0.1))
      .setPosition(9, 4.2, -7)
    const tileMatrix = new Matrix4().makeTranslation(5, 0, -4)
    const geometry = source.clone().applyMatrix4(tileMatrix.clone().invert().multiply(transform))
    const entry: TileSurface = {
      surface: {
        id: 'chair',
        transform,
        mapping: { kind: 'source', geometry: source },
        materials: [new MeshBasicMaterial()],
      },
    }
    const positions = geometry.getAttribute('position'),
      index = geometry.index!
    const expectedNormals = geometry.getAttribute('normal').clone()
    const originalIndex = [...index.array]
    for (let i = 0; i < index.count; i += 3) {
      const material =
        source.groups.find((group) => i >= group.start && i < group.start + group.count)
          ?.materialIndex ?? 0
      geometry.userData.expectedSides ??= []
      for (let j = 0; j < 3; j++) geometry.userData.expectedSides[index.getX(i + j)] = material
      const first = index.getX(i)
      index.setX(i, index.getX(i + 1))
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, first)
    }
    geometry.deleteAttribute('uv')
    geometry.deleteAttribute('color')
    mapFragmentTile(geometry, tileMatrix, Array(positions.count).fill(entry))
    const uv = geometry.getAttribute('uv'),
      normal = geometry.getAttribute('normal')
    for (const i of new Set(index.array)) {
      expect(geometry.userData.houseitSides[i]).toBe(geometry.userData.expectedSides[i])
      expect(uv.getX(i)).toBeCloseTo(source.getAttribute('uv').getX(i), 5)
      expect(uv.getY(i)).toBeCloseTo(source.getAttribute('uv').getY(i), 5)
      for (const axis of ['getX', 'getY', 'getZ'] as const)
        expect(normal[axis](i)).toBeCloseTo(expectedNormals[axis](i), 5)
      if (source.hasAttribute('color'))
        for (const axis of ['getX', 'getY', 'getZ'] as const)
          expect(geometry.getAttribute('color')[axis](i)).toBeCloseTo(
            source.getAttribute('color')[axis](i),
            5,
          )
    }
    expect(geometry.getAttribute('position')).toBe(positions)
    expect(geometry.index).toBe(index)
    expect([...index.array]).not.toEqual(originalIndex)
    source.dispose()
    geometry.dispose()
  })
  it('keeps neutral colours on uncoloured geometry sharing a terrain tile', () => {
    const ground = new PlaneGeometry(2, 2)
    ground.setAttribute('color', new Float32BufferAttribute(Array(12).fill(0.8), 3))
    const plain = new PlaneGeometry(2, 2)
    const material = new MeshBasicMaterial()
    const source = ground.clone()
    source.deleteAttribute('color')
    const transform = new Matrix4().makeTranslation(4, 0, 0)
    const shifted = plain.clone().applyMatrix4(transform)
    const tile = mergeGeometries([source, shifted])!
    const entry = (id: string, geometry: PlaneGeometry, transform: Matrix4): TileSurface => ({
      surface: {
        id,
        transform,
        mapping: { kind: 'source', geometry },
        materials: [material],
      },
    })
    mapFragmentTile(tile, new Matrix4(), [
      ...Array<TileSurface>(4).fill(entry('ground', ground, new Matrix4())),
      ...Array<TileSurface>(4).fill(entry('plain', plain, transform)),
    ])
    const colours = tile.getAttribute('color')
    for (let i = 0; i < 8; i++)
      for (const axis of ['getX', 'getY', 'getZ'] as const)
        expect(colours[axis](i)).toBeCloseTo(i < 4 ? 0.8 : 1)
    for (const geometry of [ground, plain, source, shifted, tile]) geometry.dispose()
    material.dispose()
  })
})
