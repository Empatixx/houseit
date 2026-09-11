import { CATALOG_FLOOR_MATERIALS } from './catalog'

export type FloorMaterial = {
  id: string
  label: string
  unit: { width: number; depth: number }
  texture: string
  colour: string
}

export const FLOOR_MATERIALS: readonly FloorMaterial[] = [
  ...CATALOG_FLOOR_MATERIALS,
  {
    id: 'ceramic-tile',
    label: 'Ceramic tile',
    unit: { width: 600, depth: 600 },
    texture: 'building/ceramic-tile.svg',
    colour: '#c8c7c3',
  },
  {
    id: 'laminate',
    label: 'Laminate',
    unit: { width: 1600, depth: 1350 },
    texture: 'surfaces/ash.jpg',
    colour: '#dfbd96',
  },
  {
    id: 'vinyl',
    label: 'PVC vinyl',
    unit: { width: 1000, depth: 1000 },
    texture: 'building/vinyl.svg',
    colour: '#b9b6ae',
  },
  {
    id: 'carpet',
    label: 'Carpet',
    unit: { width: 100, depth: 100 },
    texture: 'building/carpet.svg',
    colour: '#8d9294',
  },
  {
    id: 'epoxy',
    label: 'Epoxy resin',
    unit: { width: 1000, depth: 1000 },
    texture: 'building/epoxy.svg',
    colour: '#b5b9ba',
  },
]

export const FLOOR_MATERIAL_IDS = FLOOR_MATERIALS.map((material) => material.id)

export const floorMaterial = (id: string): FloorMaterial | undefined =>
  FLOOR_MATERIALS.find((material) => material.id === id)
