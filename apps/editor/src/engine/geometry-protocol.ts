import type { ProfileBody } from './profile-geometry'
import type { WallBody } from './wall-body'

export type GeometryInput =
  | { kind: 'wall'; body: WallBody }
  | { kind: 'profile'; body: ProfileBody }
export type GeometryRequest = { id: number; input: GeometryInput }
export type GeometryData = {
  positions: Float32Array
  normals: Float32Array
  uv: Float32Array
  groups: { start: number; count: number; materialIndex?: number }[]
}
export type GeometryResponse = { id: number; data: GeometryData } | { id: number; error: string }
