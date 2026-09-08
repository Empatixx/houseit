import { PAINT } from '../finishes'
import { disc, drum, legs, slab } from '../pieces'
import type { Builder } from './builder'

export const treadmill: Builder = ({ w, d, h, body, frame }) => [
  slab({ base: 80, h: 120, w: w - 200, d: d * 0.72, z: -d * 0.12, paint: PAINT.dark }),
  slab({ h: 80, w: w - 100, d: d * 0.78, z: -d * 0.1, paint: frame }),
  slab({ base: 0, h, w, d: 120, z: d / 2 - 60, paint: body }),
  ...[-(w / 2 - 40), w / 2 - 40].map((x) =>
    slab({ x, base: 900, h: 40, w: 40, d: d * 0.6, z: d * 0.15, paint: frame }),
  ),
]

export const exerciseBike: Builder = ({ w, d, frame, body }) => [
  ...[-(d / 2 - 60), d / 2 - 60].map((z) => slab({ z, h: 40, w, d: 60, paint: frame })),
  slab({ h: 60, w: 80, d: d - 120, paint: frame }),
  disc({ y: 400, z: -d / 4, r: 300, thick: 80, facing: 'side', paint: PAINT.dark }),
  drum({ z: d / 4, base: 60, r: 30, h: 800, paint: frame }),
  slab({ z: d / 4, base: 860, h: 60, w: 260, d: 300, paint: body }),
  drum({ z: -d / 4, base: 60, r: 30, h: 1000, paint: frame }),
  slab({ z: -d / 4, base: 1060, h: 30, w: w - 100, d: 60, paint: frame }),
]

export const weightRack: Builder = ({ w, d, h, frame }) => [
  ...[-(w / 2 - 30), w / 2 - 30].map((x) => slab({ x, h, w: 60, d, paint: frame })),
  ...[0.2, 0.55, 0.9].map((at) => slab({ base: h * at, h: 40, w: w - 120, d, paint: frame })),
  ...[0.2, 0.55, 0.9].flatMap((at) =>
    [-0.3, 0, 0.3].map((along) =>
      disc({
        x: along * (w - 200),
        y: h * at + 40 + 60,
        r: 60,
        thick: 260,
        facing: 'side',
        paint: PAINT.dark,
      }),
    ),
  ),
]

export const gymBench: Builder = ({ w, d, body, frame }) => [
  slab({ base: 420, h: 60, w, d, paint: body }),
  ...legs({ w, d, h: 420, thick: 40, inset: 80, paint: frame }),
]
