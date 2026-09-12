import type { WallBody } from './wall-body'

export type GeometryRequest = { id: number; body: WallBody }
export type GeometryData = {
  positions: Float32Array
  normals: Float32Array
  uv: Float32Array
  groups: { start: number; count: number; materialIndex?: number }[]
}
export type GeometryResponse = { id: number; data: GeometryData } | { id: number; error: string }
