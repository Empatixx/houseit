import { PAINT } from '../finishes'
import { along, ball, drum, legs, slab } from '../pieces'
import type { Builder } from './builder'

export const plant: Builder = ({ w, h }) => [
  drum({ r: w * 0.2, top: w * 0.25, h: h * 0.32, paint: PAINT.terracotta, open: true }),
  drum({ base: h * 0.32 - 40, r: w * 0.23, h: 10, paint: PAINT.soil }),
  ball({ y: h * 0.68, r: w * 0.34, paint: PAINT.leaf }),
  ball({ x: w * 0.2, y: h * 0.56, z: w * 0.1, r: w * 0.26, paint: PAINT.leafDark }),
  ball({ x: -w * 0.17, y: h * 0.62, z: -w * 0.15, r: w * 0.25, paint: PAINT.leafLight }),
  ball({ x: -w * 0.05, y: h * 0.84, z: w * 0.12, r: w * 0.2, paint: PAINT.leafLight }),
]

export const floorLamp: Builder = ({ h, frame }) => [
  drum({ r: 150, h: 20, paint: frame }),
  drum({ base: 20, r: 14, h: h - 320, paint: frame }),
  drum({ base: h - 300, r: 240, top: 140, h: 300, paint: PAINT.shade, open: true }),
  drum({ base: h - 200, r: 40, h: 60, paint: PAINT.lamp }),
]

export const tableLamp: Builder = ({ h, frame }) => [
  drum({ r: 90, h: 20, paint: frame }),
  drum({ base: 20, r: 12, h: h - 240, paint: frame }),
  drum({ base: h - 220, r: 170, top: 100, h: 220, paint: PAINT.shade, open: true }),
  drum({ base: h - 150, r: 34, h: 50, paint: PAINT.lamp }),
]

export const column: Builder = ({ w, d, h }) => [slab({ h, w, d, paint: PAINT.wall })]

export const railing: Builder = ({ w, d, h, frame }) => {
  const posts = Math.max(2, Math.round(w / 900) + 1)
  return [
    ...along(posts, (i) => -w / 2 + 20 + (i * (w - 40)) / (posts - 1)).map((x) =>
      slab({ x, h, w: 40, d: Math.max(d, 40), paint: frame }),
    ),
    slab({ base: h - 40, h: 40, w, d: Math.max(d, 50), paint: frame }),
    slab({ base: 100, h: h - 160, w: w - 40, d: 12, paint: PAINT.glass }),
  ]
}

export const pictureFrame: Builder = ({ w, d, h, frame }) => [
  slab({ h, w, d, paint: frame }),
  slab({ base: 40, h: h - 80, w: w - 80, d: d + 4, z: -2, paint: PAINT.canvas }),
]

export const bbq: Builder = ({ w, d }) => [
  slab({ h: 900, w: w * 0.6, d, x: -w * 0.2, paint: PAINT.steel }),
  slab({ base: 900, h: 220, w: w * 0.6, d, x: -w * 0.2, paint: PAINT.dark }),
  slab({ base: 880, h: 20, w: w * 0.36, d: d - 100, x: w * 0.3, paint: PAINT.steel }),
  ...legs({ w: w * 0.36, d: d - 100, h: 880, x: w * 0.3, thick: 30, inset: 30, paint: PAINT.dark }),
]
