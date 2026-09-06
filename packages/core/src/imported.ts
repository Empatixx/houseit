export type ImportedType = {
  id: string
  label: string
  size: { width: number; depth: number; height: number }
  surfaces?: readonly string[]
  stands?: 'wall' | 'free'
  layer?: 'under' | 'floor' | 'over'
  rooms?: readonly string[]
  parts?: readonly Box[]
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
  {
    id: 'corner-bench',
    label: 'Corner Bench',
    size: { width: 1800, depth: 1800, height: 850 },
    surfaces: ['oak', 'walnut', 'white', 'grey', 'linen'],
    stands: 'wall',
    rooms: ['kitchen', 'dining', 'living', 'any'],
    parts: [
      { x0: 0, y0: 0, x1: 1, y1: 0.35 },
      { x0: 0, y0: 0, x1: 0.35, y1: 1 },
    ],
    model: 'corner-bench.glb',
  },
]

export const importedType = (id: string): ImportedType | undefined =>
  IMPORTED_TYPES.find((entry) => entry.id === id)

export const modelFileOf = (id: string): string | undefined => importedType(id)?.model

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
