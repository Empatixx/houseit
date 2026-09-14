import type { Corner } from '@houseit/scene/pieces'
import type { GeometryEngine } from '@thatopen/fragments'
import type { BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { profileGeometry } from './profile-geometry'

export const GROUND_REACH = 400
const PATCHES = 128
export type GroundInput = { kind: 'ground'; holes: Corner[][] }

export function groundGeometry(engine: GeometryEngine, input: GroundInput) {
  const half = GROUND_REACH * 500
  if (input.holes.length)
    return profileGeometry(engine, {
      kind: 'sheet',
      holes: input.holes,
      outline: [
        { x: -half, z: half },
        { x: half, z: half },
        { x: half, z: -half },
        { x: -half, z: -half },
      ],
    })
  const cell = GROUND_REACH / PATCHES
  const face = profileGeometry(engine, {
    kind: 'sheet',
    holes: [],
    outline: [
      { x: cell * 1000, z: 0 },
      { x: cell * 1000, z: -cell * 1000 },
      { x: 0, z: -cell * 1000 },
      { x: 0, z: 0 },
    ],
  })
  const repeat = (part: BufferGeometry, axis: 'x' | 'y') => {
    const parts = Array.from({ length: PATCHES }, (_, i) =>
      part.clone().translate(axis === 'x' ? i * cell : 0, axis === 'y' ? i * cell : 0, 0),
    )
    try {
      const result = mergeGeometries(parts)
      if (!result) throw new Error('Cannot combine native ground cells')
      return result
    } finally {
      for (const part of parts) part.dispose()
    }
  }
  const row = repeat(face, 'x')
  try {
    return repeat(row, 'y').translate(-GROUND_REACH / 2, -GROUND_REACH / 2, 0)
  } finally {
    row.dispose()
    face.dispose()
  }
}
