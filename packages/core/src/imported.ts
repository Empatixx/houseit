export type ImportedType = {
  id: string
  label: string
  size: { width: number; depth: number; height: number }
  surfaces?: readonly string[]
  stands?: 'wall' | 'free'
  layer?: 'under' | 'floor' | 'over'
  rooms?: readonly string[]
  model: string
}

const WOODS = ['walnut', 'oak', 'white', 'black', 'marble', 'steel'] as const

export const IMPORTED_TYPES: readonly ImportedType[] = [
  {
    id: 'wardrobe',
    label: 'Wardrobe',
    size: { width: 1200, depth: 630, height: 2000 },
    surfaces: WOODS,
    stands: 'wall',
    rooms: ['bedroom', 'walk-in', 'any'],
    model: 'wardrobe.glb',
  },
]

export const importedType = (id: string): ImportedType | undefined =>
  IMPORTED_TYPES.find((entry) => entry.id === id)

export const modelFileOf = (id: string): string | undefined => importedType(id)?.model

const LINE = '#212121'
const round = (value: number) => Math.round(value)

export function outlineSymbol(type: ImportedType): string {
  const { width, depth } = type.size
  const inset = 14
  return [
    `<svg width="${round(width)}" height="${round(depth)}" viewBox="0 0 ${round(width)} ${round(depth)}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    `<rect x="${inset / 2}" y="${inset / 2}" width="${round(width - inset)}" height="${round(depth - inset)}" fill="#ffffff" stroke="${LINE}" stroke-width="${inset}"/>`,
    `<line x1="${inset}" y1="${round(depth * 0.72)}" x2="${round(width - inset)}" y2="${round(depth * 0.72)}" stroke="${LINE}" stroke-width="${inset / 2}"/>`,
    '</svg>',
  ].join('')
}
