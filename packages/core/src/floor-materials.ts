import { CATALOG_FLOOR_MATERIALS } from './catalog'

export type FloorMaterial = {
  id: string
  label: string
  unit: { width: number; depth: number }
  texture: string
  colour: string
}

export const FLOOR_MATERIALS: readonly FloorMaterial[] = CATALOG_FLOOR_MATERIALS

export const FLOOR_MATERIAL_IDS = FLOOR_MATERIALS.map((material) => material.id)

export const floorMaterial = (id: string): FloorMaterial | undefined =>
  FLOOR_MATERIALS.find((material) => material.id === id)
