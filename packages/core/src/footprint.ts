export type Part = { x0: number; y0: number; x1: number; y1: number }

const WHOLE: readonly Part[] = [{ x0: 0, y0: 0, x1: 1, y1: 1 }]

const ell = (back: number, leg: number): readonly Part[] => [
  { x0: 0, y0: 0, x1: 1, y1: back },
  { x0: 0, y0: 0, x1: leg, y1: 1 },
]

const ellRight = (back: number, leg: number): readonly Part[] => [
  { x0: 0, y0: 0, x1: 1, y1: back },
  { x0: 1 - leg, y0: 0, x1: 1, y1: 1 },
]

const horseshoe = (back: number, leg: number): readonly Part[] => [
  { x0: 0, y0: 0, x1: 1, y1: back },
  { x0: 0, y0: 0, x1: leg, y1: 1 },
  { x0: 1 - leg, y0: 0, x1: 1, y1: 1 },
]

const SHAPED: Record<string, readonly Part[]> = {
  'kitchen-l': ell(0.32, 0.25),
  'kitchen-l-mini': ell(0.38, 0.32),
  'kitchen-l-mini-wall': ell(0.38, 0.32),
  'kitchen-u': horseshoe(0.25, 0.25),
  'kitchen-u-wall': horseshoe(0.25, 0.25),
  'counter-l': ell(0.56, 0.32),
  'office-desk-l': ell(0.38, 0.38),
  'sofa-l': ellRight(0.56, 0.32),
  'stairs-l-landing': ell(0.35, 0.35),
  'stairs-l-winder': ell(0.35, 0.35),
}

export const FILLS_ITS_BOX: Record<string, string> = {
  'shower-l': 'large rather than L-shaped: the l is a size, like shower-s and shower-m',
  'stairs-u':
    'its two flights and the landing across their heads fill the rectangle, however much it looks like a U',
}

export const declaresParts = (type: string): boolean => type in SHAPED

export const partsOf = (type: string): readonly Part[] => SHAPED[type] ?? WHOLE
