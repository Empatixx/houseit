import type { GeometryEngine } from '@thatopen/fragments'
import type { GeometryInput } from './geometry-protocol'
import { groundGeometry } from './ground-geometry'
import { primitiveGeometry } from './primitive-geometry'
import { profileGeometry } from './profile-geometry'
import { sheetGeometry } from './sheet-geometry'
import { wallGeometry } from './wall-geometry'

export function generateGeometry(engine: GeometryEngine, input: GeometryInput) {
  switch (input.kind) {
    case 'wall':
      return wallGeometry(engine, input.body)
    case 'profile':
      return profileGeometry(engine, input.body)
    case 'primitive':
      return primitiveGeometry(engine, input.body)
    case 'sheets':
      return sheetGeometry(engine, input)
    case 'ground':
      return groundGeometry(engine, input)
  }
}
