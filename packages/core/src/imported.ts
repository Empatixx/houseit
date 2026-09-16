export type ImportedType = {
  id: string
  label: string
  size: { width: number; depth: number; height: number }
  surfaces?: readonly string[]
  stands?: 'wall' | 'free'
  layer?: 'under' | 'floor' | 'over'
  rooms?: readonly string[]
  parts?: readonly Box[]
  symbol?: string
  model: string
}

const WOODS = ['walnut', 'oak', 'white', 'black', 'marble', 'steel'] as const
const UPHOLSTERY = [
  'linen',
  'grey',
  'blue',
  'green',
  'fabric',
  'rust',
  'white',
  'graphite',
] as const

export const IMPORTED_TYPES: readonly ImportedType[] = [
  {
    id: 'bed-upholstered',
    label: 'Upholstered Bed — Low Headboard',
    size: { width: 1940, depth: 2180, height: 1120 },
    surfaces: UPHOLSTERY,
    stands: 'wall',
    rooms: ['bedroom'],
    symbol: 'queen-bed.svg',
    model: 'bed-upholstered.glb',
  },
  {
    id: 'bed-channelled',
    label: 'Upholstered Bed — Channelled Headboard',
    size: { width: 1940, depth: 2240, height: 1270 },
    surfaces: UPHOLSTERY,
    stands: 'wall',
    rooms: ['bedroom'],
    symbol: 'queen-bed.svg',
    model: 'bed-channelled.glb',
  },
  {
    id: 'table-rectangular',
    label: 'Dining Table — Wood and Steel',
    size: { width: 1800, depth: 900, height: 760 },
    surfaces: ['oak', 'walnut', 'white', 'black'],
    stands: 'free',
    rooms: ['dining', 'kitchen', 'living_room', 'any'],
    symbol: 'table-rectangular.svg',
    model: 'table-rectangular.glb',
  },
  {
    id: 'table-round',
    label: 'Dining Table — Round Wood',
    size: { width: 1220, depth: 1220, height: 750 },
    surfaces: ['oak', 'walnut', 'white', 'black'],
    stands: 'free',
    rooms: ['dining', 'kitchen', 'living_room', 'any'],
    symbol: 'coffee-table.svg',
    model: 'table-round.glb',
  },
  {
    id: 'television-flat',
    label: 'Flat-screen TV — on Cabinet',
    size: { width: 1120, depth: 225, height: 746 },
    surfaces: ['black', 'graphite', 'white'],
    stands: 'free',
    layer: 'over',
    rooms: ['living_room', 'bedroom', 'any'],
    symbol: 'television-flat.svg',
    model: 'television-flat.glb',
  },
  {
    id: 'tv-stand-wood',
    label: 'TV Cabinet — Wood and White',
    size: { width: 1800, depth: 442, height: 580 },
    surfaces: ['oak', 'walnut', 'white', 'black'],
    stands: 'wall',
    rooms: ['living_room', 'bedroom', 'any'],
    symbol: 'dresser.svg',
    model: 'tv-stand-wood.glb',
  },
  {
    id: 'dining-chair',
    label: 'Wooden Dining Chair',
    size: { width: 440, depth: 460, height: 940 },
    surfaces: ['oak', 'walnut', 'white', 'black'],
    stands: 'free',
    rooms: ['dining', 'living_room', 'kitchen', 'any'],
    symbol: 'dining-chair.svg',
    model: 'dining-chair-classic.glb',
  },
  {
    id: 'wardrobe',
    label: 'Wardrobe',
    size: { width: 1200, depth: 630, height: 2000 },
    surfaces: WOODS,
    stands: 'wall',
    rooms: ['bedroom', 'walk-in', 'any'],
    model: 'wardrobe-classic.glb',
  },
  {
    id: 'bathtub',
    label: 'Bathtub',
    size: { width: 1549, depth: 838, height: 657 },
    surfaces: ['white'],
    stands: 'wall',
    rooms: ['bathroom', 'any'],
    model: 'bath-built-in-detailed.glb',
  },
]

export const importedType = (id: string): ImportedType | undefined =>
  IMPORTED_TYPES.find((entry) => entry.id === id)

const CATALOG_MODELS: Readonly<Record<string, string>> = {
  'sofa-2': 'sofa-classic-two.glb',
  'sofa-3': 'sofa-classic-three.glb',
  'sofa-l': 'sofa-classic-chaise.glb',
  'club-chair': 'armchair-classic.glb',
  'lounge-chair-s': 'armchair-classic.glb',
  'office-chair': 'office-chair-classic.glb',
  'cal-king-bed': 'bed-upholstered.glb',
  'king-bed': 'bed-upholstered.glb',
  'queen-bed': 'bed-upholstered.glb',
  'full-bed': 'bed-upholstered.glb',
  'twin-bed': 'bed-single-upholstered.glb',
  crib: 'crib-rounded.glb',
  nightstand: 'nightstand-rounded.glb',
  dresser: 'dresser-three-drawer.glb',
  bookshelf: 'bookshelf-classic.glb',
  credenza: 'sideboard-oak-white.glb',
  bench: 'bench-storage-cushioned.glb',
  'console-mirror': 'console-rounded-mirror.glb',
  'coat-stand': 'coat-stand-curved.glb',
  'clothing-rack': 'clothing-rack-arched.glb',
  'lounge-chair': 'chaise-soft.glb',
  'chair-ottoman': 'wingback-with-ottoman.glb',
  'built-in-shelf': 'shelving-fitted.glb',
  'office-desk': 'desk-oak-steel.glb',
  'office-desk-l': 'desk-corner-oak.glb',
  'filing-cabinet': 'filing-three-drawer.glb',
  refrigerator: 'fridge-freezer-classic.glb',
  dishwasher: 'dishwasher-classic.glb',
  stove: 'cooker-ceramic-classic.glb',
  'kitchen-i-mini': 'kitchen-i-mini-detailed.glb',
  'kitchen-i': 'kitchen-i-detailed.glb',
  'kitchen-l-mini': 'kitchen-l-mini-detailed.glb',
  'kitchen-l': 'kitchen-l-detailed.glb',
  'kitchen-u': 'kitchen-u-detailed.glb',
  'kitchen-i-mini-wall': 'kitchen-i-mini-wall-detailed.glb',
  'kitchen-i-wall': 'kitchen-i-wall-detailed.glb',
  'kitchen-l-mini-wall': 'kitchen-l-mini-wall-detailed.glb',
  'kitchen-u-wall': 'kitchen-u-wall-detailed.glb',
  'island-2': 'island-two-detailed.glb',
  'island-4': 'island-four-detailed.glb',
  'island-2-sink': 'island-two-sink-detailed.glb',
  'island-4-sink': 'island-four-sink-detailed.glb',
  'washer-dryer': 'laundry-pair-detailed.glb',
  'washer-dryer-stacked': 'laundry-stack-detailed.glb',
  'shower-s': 'shower-small-detailed.glb',
  'shower-m': 'shower-medium-detailed.glb',
  'shower-l': 'shower-large-detailed.glb',
  'toilet-tank': 'toilet-classic-detailed.glb',
  'vanity-sink': 'vanity-single-detailed.glb',
  'vanity-double': 'vanity-double-detailed.glb',
  'bathtub-free': 'bath-freestanding-detailed.glb',
  bar: 'bar-display-detailed.glb',
  'bar-island': 'bar-serving-island-detailed.glb',
  'counter-straight': 'counter-straight-detailed.glb',
  'counter-l': 'counter-corner-detailed.glb',
  'kitchen-sink': 'counter-double-sink.glb',
  'coffee-table': 'coffee-table.glb',
  'side-table': 'side-table.glb',
}

export const modelFileOf = (id: string): string | undefined =>
  CATALOG_MODELS[id] ?? importedType(id)?.model

const LINE = '#212121'
const round = (value: number) => Math.round(value)

type Box = { x0: number; y0: number; x1: number; y1: number }

const WHOLE: readonly Box[] = [{ x0: 0, y0: 0, x1: 1, y1: 1 }]

export function outlineSymbol(type: ImportedType): string {
  const { width, depth } = type.size
  const parts = type.parts ?? WHOLE
  const inset = 14
  const rect = (part: Box) => {
    const x = part.x0 * width
    const y = part.y0 * depth
    const w = (part.x1 - part.x0) * width
    const d = (part.y1 - part.y0) * depth
    return `<rect x="${round(x + inset / 2)}" y="${round(y + inset / 2)}" width="${round(w - inset)}" height="${round(d - inset)}" fill="#ffffff" stroke="${LINE}" stroke-width="${inset}"/>`
  }
  return [
    `<svg width="${round(width)}" height="${round(depth)}" viewBox="0 0 ${round(width)} ${round(depth)}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    ...parts.map(rect),
    '</svg>',
  ].join('')
}
