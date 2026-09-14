import { CATALOG_FLOOR_MATERIALS } from './catalog'

export type FloorMaterial = {
  id: string
  label: string
  unit: { width: number; depth: number }
  texture: string
  colour: string
}

const GRASS: FloorMaterial = {
  id: 'grass',
  label: 'Lawn',
  unit: { width: 1600, depth: 1600 },
  texture: 'grass.png',
  colour: '#6f9a4a',
}

export const FLOOR_MATERIALS: readonly FloorMaterial[] = [...CATALOG_FLOOR_MATERIALS, GRASS]

export const FLOOR_MATERIAL_IDS = FLOOR_MATERIALS.map((material) => material.id)

export const floorMaterial = (id: string): FloorMaterial | undefined =>
  FLOOR_MATERIALS.find((material) => material.id === id)
