import { lighter, PAINT } from '../finishes'
import { along, drum, type Piece, put, slab } from '../pieces'
import type { Builder, Part } from './builder'

type Run = { x?: number; z?: number; w?: number; d?: number; upper?: boolean }

function run(part: Part, { x = 0, z = 0, w = part.w, d = part.d, upper = false }: Run): Piece[] {
  const { body, frame } = part
  const doors = Math.max(1, Math.round(w / 600))
  return put({ x, z }, [
    slab({ z: 30, h: 100, w: w - 60, d: d - 80, paint: PAINT.dark }),
    slab({ z: 10, base: 100, h: 760, w, d: d - 20, paint: body }),
    slab({ base: 860, h: 40, w, d, paint: PAINT.worktop }),
    ...along(doors, (i) => -w / 2 + ((i + 0.5) * w) / doors).map((at) =>
      slab({
        x: at,
        z: -d / 2 + 10 - 12,
        base: 720,
        h: 24,
        w: Math.min(200, w / doors - 60),
        d: 28,
        paint: frame,
      }),
    ),
    ...(upper ? [slab({ z: d / 2 - 175, base: 1450, h: 700, w, d: 350, paint: body })] : []),
  ])
}

const sinkBasin = (x: number, z: number): Piece[] => [
  slab({ x, z, base: 900, h: 8, w: 720, d: 420, paint: PAINT.steel }),
  slab({ x, z, base: 904, h: 6, w: 650, d: 350, paint: PAINT.dark }),
  drum({ x, z: z + 250, base: 900, r: 14, h: 260, paint: PAINT.steel }),
  slab({ x, z: z + 150, base: 1140, h: 20, w: 20, d: 200, paint: PAINT.steel }),
]

export const kitchenI =
  (upper: boolean): Builder =>
  (part) =>
    run(part, { upper })

export const kitchenL =
  (upper: boolean): Builder =>
  (part) => {
    const { w, d } = part
    const deep = Math.min(650, d / 2)
    return [
      ...run(part, { z: d / 2 - deep / 2, d: deep, upper }),
      ...put(
        { x: w / 2 - deep / 2, z: -deep / 2, turn: Math.PI / 2 },
        run(part, { w: d - deep, d: deep, upper }),
      ),
    ]
  }

export const kitchenU =
  (upper: boolean): Builder =>
  (part) => {
    const { w, d } = part
    const deep = Math.min(650, d / 2, w / 3)
    return [
      ...run(part, { z: d / 2 - deep / 2, d: deep, upper }),
      ...put(
        { x: -(w / 2 - deep / 2), z: -deep / 2, turn: -Math.PI / 2 },
        run(part, { w: d - deep, d: deep, upper }),
      ),
      ...put(
        { x: w / 2 - deep / 2, z: -deep / 2, turn: Math.PI / 2 },
        run(part, { w: d - deep, d: deep, upper }),
      ),
    ]
  }

export const kitchenSink: Builder = (part) => [...run(part, {}), ...sinkBasin(0, 20)]

export const stove: Builder = (part) => {
  const { w, d, frame } = part
  return [
    ...run({ ...part, body: PAINT.steel, frame: PAINT.dark }, {}),
    slab({ base: 900, h: 10, w: w - 40, d: d - 40, paint: PAINT.black }),
    ...[-w / 4, w / 4].flatMap((x) =>
      [-d / 5, d / 5].map((z) => drum({ x, z, base: 910, r: 95, h: 8, paint: PAINT.dark })),
    ),
    slab({ base: 900, h: 120, w, d: 40, z: d / 2 - 20, paint: PAINT.steel }),
    slab({ base: 560, h: 12, w: w - 60, d: 12, z: -d / 2 - 6, paint: frame }),
  ]
}

export const fridge: Builder = ({ w, d, h, body, frame }) => [
  slab({ h, w, d, paint: body }),
  slab({ base: h * 0.68, h: 12, w, d: 12, z: -d / 2 - 4, paint: PAINT.dark }),
  slab({
    x: -(w / 2 - 90),
    z: -d / 2 - 18,
    base: h * 0.72,
    h: h * 0.2,
    w: 22,
    d: 30,
    paint: frame,
  }),
  slab({
    x: -(w / 2 - 90),
    z: -d / 2 - 18,
    base: h * 0.3,
    h: h * 0.3,
    w: 22,
    d: 30,
    paint: frame,
  }),
]

export const dishwasher: Builder = (part) => [
  ...run({ ...part, frame: PAINT.dark }, {}),
  slab({ base: 830, h: 40, w: part.w - 40, d: 10, z: -part.d / 2 - 5, paint: PAINT.dark }),
]

export const island =
  (basin: boolean): Builder =>
  (part) => {
    const { w, d, frame } = part
    const stools = Math.max(2, Math.round(w / 700))
    const counter = d - 450
    return [
      ...run(part, { z: 225, d: counter }),
      slab({ base: 860, h: 40, w, d: d - 100, z: -50, paint: PAINT.worktop }),
      ...(basin ? sinkBasin(0, 250) : []),
      ...along(stools, (i) => -w / 2 + ((i + 0.5) * w) / stools).flatMap((x) => [
        drum({ x, z: -d / 2 + 200, r: 170, h: 20, paint: frame }),
        drum({ x, z: -d / 2 + 200, base: 20, r: 20, h: 640, paint: frame }),
        drum({ x, z: -d / 2 + 200, base: 660, r: 180, h: 50, paint: lighter(frame, 0.3) }),
      ]),
    ]
  }

export const waterHeater: Builder = ({ w, h }) => [
  drum({ r: w / 2, h, paint: PAINT.porcelain }),
  drum({ r: w / 2 - 40, base: h, h: 40, paint: PAINT.steel }),
]

export const hvac: Builder = ({ w, d, h }) => [
  slab({ h, w, d, paint: PAINT.steel }),
  slab({ base: h, h: 20, w: w - 100, d: d - 100, paint: PAINT.dark }),
]
