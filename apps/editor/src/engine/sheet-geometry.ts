import type { Body } from '@houseit/scene/pieces'
import type { GeometryEngine } from '@thatopen/fragments'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { profileGeometry } from './profile-geometry'

export type SheetInput = {
  kind: 'sheets'
  profiles: Omit<Extract<Body, { kind: 'sheet' }>, 'kind'>[]
  textureSize?: { width: number; depth: number }
}

export function rectangleSheet(size: { width: number; depth: number }): SheetInput {
  const x = size.width / 2,
    z = size.depth / 2
  return {
    kind: 'sheets',
    textureSize: size,
    profiles: [
      {
        outline: [
          { x, z },
          { x, z: -z },
          { x: -x, z: -z },
          { x: -x, z },
        ],
        holes: [],
      },
    ],
  }
}

export function sheetGeometry(engine: GeometryEngine, input: SheetInput) {
  const parts = input.profiles.map((profile) =>
    profileGeometry(engine, { ...profile, kind: 'sheet' }),
  )
  try {
    if (!parts.length) {
      const empty = new BufferGeometry()
      for (const [name, size] of [
        ['position', 3],
        ['normal', 3],
        ['uv', 2],
      ] as const)
        empty.setAttribute(name, new Float32BufferAttribute([], size))
      return empty
    }
    const geometry = mergeGeometries(parts)
    if (!geometry) throw new Error('Cannot combine native sheet profiles')
    if (input.textureSize) {
      const p = geometry.getAttribute('position'),
        uv = geometry.getAttribute('uv')
      for (let i = 0; i < p.count; i++)
        uv.setXY(
          i,
          p.getX(i) / (input.textureSize.width * 0.001) + 0.5,
          p.getY(i) / (input.textureSize.depth * 0.001) + 0.5,
        )
    }
    return geometry
  } finally {
    for (const part of parts) part.dispose()
  }
}
