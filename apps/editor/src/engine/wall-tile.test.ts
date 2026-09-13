import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Uint8BufferAttribute,
} from 'three'
import { describe, expect, it } from 'vitest'
import { mapWallTile, styleWallTile, type TileWall, tileItemIds } from './wall-tile'

const wall = (id: string, transform = new Matrix4()): TileWall => ({
  surface: {
    id,
    transform,
    length: 4000,
    height: 2500,
    materials: [
      new MeshBasicMaterial({ color: '#adc4d8' }),
      new MeshBasicMaterial({ color: '#b65030' }),
    ],
  },
})
const face = (normal: number) => {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [0, 0, normal * 0.15, 4, 0, normal * 0.15, 4, 2.5, normal * 0.15],
      3,
    ),
  )
  geometry.setAttribute(
    'normal',
    new Float32BufferAttribute([0, 0, normal, 0, 0, normal, 0, 0, normal], 3),
  )
  geometry.setIndex([0, 1, 2])
  return geometry
}

describe('Native wall tile appearance', () => {
  it('reads native RGBA item IDs across byte boundaries before native local-ID translation', () => {
    expect(
      tileItemIds(
        new Uint8BufferAttribute(
          [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 255, 255, 255, 255],
          4,
        ),
      ),
    ).toEqual([0, 255, 65535, 16777215, 4294967294])
  })
  it.each([0, Math.PI / 2, Math.PI * 0.23])(
    'preserves UV scale on an elevated wall rotated by %s',
    (angle) => {
      const transform = new Matrix4().makeRotationY(angle).setPosition(8, 3.5, -4)
      const entry = wall('w1', transform),
        geometry = face(1).applyMatrix4(transform)
      mapWallTile(geometry, new Matrix4(), [entry, entry, entry])
      const uv = geometry.getAttribute('uv')
      expect(uv.getX(0)).toBeCloseTo(0, 5)
      expect(uv.getY(0)).toBeCloseTo(0, 5)
      expect(uv.getX(2)).toBeCloseTo(1, 5)
      expect(uv.getY(2)).toBeCloseTo(1, 5)
      expect(geometry.userData.houseitSides).toEqual([1, 1, 1])
      geometry.dispose()
    },
  )
  it('keeps sides and segment identities distinct inside one tile and recolours without rebuilding', () => {
    const left = wall('w1'),
      right = wall('w2'),
      a = face(-1),
      b = face(1)
    const geometry = new BufferGeometry()
    for (const name of ['position', 'normal'])
      geometry.setAttribute(
        name,
        new Float32BufferAttribute(
          [...a.getAttribute(name).array, ...b.getAttribute(name).array],
          3,
        ),
      )
    geometry.setIndex([0, 1, 2, 3, 4, 5])
    mapWallTile(geometry, new Matrix4(), [left, left, left, right, right, right])
    const mesh = new Mesh(geometry)
    styleWallTile(mesh)
    expect(geometry.groups).toEqual([
      { start: 0, count: 3, materialIndex: 0 },
      { start: 3, count: 3, materialIndex: 1 },
    ])
    expect(mesh.material).toEqual([left.surface.materials[0], right.surface.materials[1]])
    expect(geometry.userData.houseitSurface[3].surface.id).toBe('w2')
    const positions = geometry.getAttribute('position')
    right.surface.materials = [
      new MeshBasicMaterial({ color: '#714cb6' }),
      new MeshBasicMaterial({ color: '#714cb6' }),
    ]
    styleWallTile(mesh)
    expect(mesh.material).toEqual([left.surface.materials[0], right.surface.materials[1]])
    expect(geometry.getAttribute('position')).toBe(positions)
    a.dispose()
    b.dispose()
    geometry.dispose()
  })
  it('uses one plan material across sides while retaining native indices', () => {
    const entry = wall('w1')
    entry.surface.materials = [new MeshBasicMaterial({ color: '#252525' })]
    const geometry = face(1),
      mesh = new Mesh(geometry),
      index = geometry.index
    mapWallTile(geometry, new Matrix4(), [entry, entry, entry])
    styleWallTile(mesh)
    expect(mesh.material).toEqual(entry.surface.materials)
    expect(geometry.index).toBe(index)
    geometry.dispose()
  })
  it('switches a live tile from two 3D finishes to plan ink and back while geometry is pending', () => {
    const entry = wall('w1'),
      geometry = face(1),
      mesh = new Mesh(geometry)
    const finishes = entry.surface.materials
    mapWallTile(geometry, new Matrix4(), [entry, entry, entry])
    styleWallTile(mesh)
    expect(mesh.material).toEqual([finishes[1]])
    entry.surface.materials = [new MeshBasicMaterial({ color: '#252525' })]
    styleWallTile(mesh)
    expect(mesh.material).toEqual(entry.surface.materials)
    entry.surface.materials = finishes
    styleWallTile(mesh)
    expect(mesh.material).toEqual([finishes[1]])
    geometry.dispose()
  })
})
