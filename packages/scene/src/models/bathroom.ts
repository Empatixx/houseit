import { PAINT } from '../finishes'
import { along, disc, drum, type Piece, slab } from '../pieces'
import type { Builder } from './builder'

export const toilet: Builder = ({ w, d }) => {
  const bowl = d - 250
  const r = (w - 80) / 2
  return [
    slab({ base: 380, h: 420, w: w - 60, d: 190, z: d / 2 - 95, paint: PAINT.porcelain }),
    slab({ base: 800, h: 25, w: 90, d: 50, z: d / 2 - 95, paint: PAINT.steel }),
    drum({
      z: -(d / 2) + bowl / 2 + 20,
      r,
      h: 380,
      stretch: bowl / (2 * r),
      paint: PAINT.porcelain,
    }),
    drum({
      z: -(d / 2) + bowl / 2 + 20,
      base: 380,
      r: r + 15,
      h: 35,
      stretch: bowl / (2 * r),
      paint: PAINT.pale,
    }),
  ]
}

export function vanity(basins: number): Builder {
  return ({ w, d, body }) => [
    slab({ z: 30, h: 100, w: w - 80, d: d - 100, paint: PAINT.dark }),
    slab({ z: 10, base: 100, h: 700, w, d: d - 20, paint: body }),
    slab({ base: 800, h: 50, w, d, paint: PAINT.worktop }),
    ...along(basins, (i) => -w / 2 + ((i + 0.5) * w) / basins).flatMap((x) => [
      drum({ x, z: -20, base: 850, r: 215, h: 10, stretch: 0.8, paint: PAINT.porcelain }),
      drum({ x, z: -20, base: 855, r: 185, h: 8, stretch: 0.8, paint: PAINT.pale }),
      drum({ x, z: d / 2 - 110, base: 850, r: 14, h: 190, paint: PAINT.steel }),
      slab({ x, z: d / 2 - 180, base: 1020, h: 18, w: 18, d: 160, paint: PAINT.steel }),
    ]),
    slab({ base: 1000, h: 800, w: w - 160, d: 20, z: d / 2 - 10, paint: PAINT.mirror }),
  ]
}

export const bathtub: Builder = ({ w, d }) => [
  slab({ h: 120, w: w - 180, d: d - 180, paint: PAINT.pale }),
  ...[-(d / 2 - 45), d / 2 - 45].map((z) => slab({ z, h: 550, w, d: 90, paint: PAINT.porcelain })),
  ...[-(w / 2 - 45), w / 2 - 45].map((x) =>
    slab({ x, h: 550, w: 90, d: d - 180, paint: PAINT.porcelain }),
  ),
  drum({ x: w / 2 - 45, z: d / 2 - 250, base: 550, r: 14, h: 160, paint: PAINT.steel }),
  slab({
    x: w / 2 - 130,
    z: d / 2 - 250,
    base: 690,
    h: 18,
    w: 180,
    d: 18,
    paint: PAINT.steel,
  }),
]

export const shower: Builder = ({ w, d }) => [
  slab({ h: 60, w, d, paint: PAINT.pale }),
  slab({ base: 60, h: 4, w: 90, d: 90, paint: PAINT.steel }),
  slab({ base: 60, h: 1900, w: w - 40, d: 12, z: -d / 2 + 6, paint: PAINT.glass }),
  slab({ base: 60, h: 1900, w: 12, d: d - 40, x: w / 2 - 6, paint: PAINT.glass }),
  slab({ h: 1960, w: 30, d: 30, x: w / 2 - 15, z: -d / 2 + 15, paint: PAINT.dark }),
  slab({ h: 1960, w: 30, d: 30, x: -(w / 2 - 15), z: -d / 2 + 15, paint: PAINT.dark }),
  drum({ x: -(w / 2) + 250, z: d / 2 - 30, base: 900, r: 12, h: 1100, paint: PAINT.steel }),
  slab({
    x: -(w / 2) + 250 + 100,
    z: d / 2 - 130,
    base: 2000,
    h: 16,
    w: 200,
    d: 16,
    paint: PAINT.steel,
  }),
  drum({ x: -(w / 2) + 250 + 180, z: d / 2 - 180, base: 1980, r: 90, h: 16, paint: PAINT.steel }),
]

const machine = (x: number, base: number, w: number, d: number): Piece[] => [
  slab({ x, base, h: 850, w, d, paint: PAINT.porcelain }),
  disc({ x, y: base + 400, z: -d / 2 - 15, r: 240, thick: 30, paint: PAINT.steel }),
  disc({ x, y: base + 400, z: -d / 2 - 32, r: 200, thick: 6, paint: PAINT.tinted }),
  slab({ x, z: -d / 2 - 4, base: base + 780, h: 40, w: w - 60, d: 8, paint: PAINT.dark }),
]

export const washerPair: Builder = ({ w, d }) => [
  ...machine(-w / 4, 0, w / 2 - 20, d - 60),
  ...machine(w / 4, 0, w / 2 - 20, d - 60),
]

export const washerStack: Builder = ({ w, d }) => [
  ...machine(0, 0, w - 20, d - 60),
  ...machine(0, 900, w - 20, d - 60),
]
