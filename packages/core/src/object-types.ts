import { IMPORTED_TYPES } from './imported'
import { CATALOG_OBJECT_TYPES } from './catalog'

export type ObjectType = {
  id: string
  label: string
  size: { width: number; depth: number }
  surfaces: readonly string[]
  stands: 'wall' | 'free'
  seats?: number
  layer?: Layer
  abuts?: boolean
  reach?: number
  symbol: string
  rooms?: readonly string[]
}

export type Layer = 'under' | 'floor' | 'over'

const STAIR_SURFACES = ['walnut', 'oak', 'white', 'black', 'marble', 'steel'] as const

const STAIRS: readonly ObjectType[] = [
  { id: 'stairs-straight', label: 'Straight Staircase', size: { width: 900, depth: 4275 } },
  {
    id: 'stairs-l-landing',
    label: 'L-Shaped Staircase (Landing)',
    size: { width: 2115, depth: 2115 },
  },
  {
    id: 'stairs-l-winder',
    label: 'L-Shaped Staircase (Winder)',
    size: { width: 1830, depth: 1830 },
  },
  { id: 'stairs-u', label: 'U-Shaped Staircase', size: { width: 1800, depth: 3225 } },
  { id: 'stairs-spiral', label: 'Spiral Staircase', size: { width: 1600, depth: 1600 } },
].map((stair) => ({
  ...stair,
  surfaces: STAIR_SURFACES,
  stands: 'wall' as const,
  symbol: '',
  rooms: ['any'],
}))

const IMPORTED: readonly ObjectType[] = IMPORTED_TYPES.map((type) => ({
  id: type.id,
  label: type.label,
  size: { width: type.size.width, depth: type.size.depth },
  surfaces: type.surfaces ?? ['white'],
  stands: type.stands ?? 'free',
  ...(type.layer === undefined ? {} : { layer: type.layer }),
  ...(type.rooms === undefined ? {} : { rooms: type.rooms }),
  symbol: '',
}))

export const CAMERA = 'camera'

const LOOKING: ObjectType = {
  id: CAMERA,
  label: 'Camera',
  size: { width: 300, depth: 300 },
  surfaces: ['white'],
  stands: 'free',
  layer: 'over',
  symbol: 'camera.svg',
  rooms: ['any'],
}

export const OBJECT_TYPES: readonly ObjectType[] = [
  ...CATALOG_OBJECT_TYPES.filter((type) => !type.id.startsWith('stairs-')),
  ...STAIRS,
  ...IMPORTED,
  LOOKING,
]

export const OBJECT_TYPE_IDS = OBJECT_TYPES.map((entry) => entry.id)

export const objectType = (id: string): ObjectType | undefined =>
  OBJECT_TYPES.find((entry) => entry.id === id)

export const layerOf = (id: string): Layer => objectType(id)?.layer ?? 'floor'

export const symbolOf = (id: string): string | undefined => objectType(id)?.symbol || undefined
