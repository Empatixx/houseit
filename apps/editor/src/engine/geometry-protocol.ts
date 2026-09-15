import type { PrimitiveBody } from './primitive-geometry'
import type { ProfileBody } from './profile-geometry'
import type { SheetInput } from './sheet-geometry'
import type { WallBody } from './wall-body'

export type GeometryInput =
  | GroundInput
  | SheetInput
  | { kind: 'wall'; body: WallBody }
  | { kind: 'profile'; body: ProfileBody }
  | { kind: 'primitive'; body: PrimitiveBody }
export type GeometryRequest = { id: number; input: GeometryInput }
export type GeometryData = {
  positions: Float32Array
  normals: Float32Array
  uv: Float32Array
  groups: { start: number; count: number; materialIndex?: number }[]
}
export type GeometryResponse = { id: number; data: GeometryData } | { id: number; error: string }

import type { GroundInput } from './ground-geometry'
