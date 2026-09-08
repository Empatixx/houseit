import { PAINT } from '../finishes'
import { along, drum, lean, legs, slab } from '../pieces'
import { type Builder, cabinet } from './builder'

export const officeDesk: Builder = ({ w, d, h, body, frame }) => [
  slab({ base: h - 40, h: 40, w, d, paint: body }),
  ...[-(w / 2 - 40), w / 2 - 40].map((x) =>
    slab({ x, h: h - 40, w: 80, d: d - 100, paint: frame }),
  ),
  slab({ base: h - 640, h: 600, w: w - 160, d: 30, z: d / 2 - 60, paint: frame }),
]

export const officeDeskL: Builder = ({ w, d, h, body, frame }) => {
  const run = 800
  return [
    slab({ base: h - 40, h: 40, w, d: run, z: d / 2 - run / 2, paint: body }),
    slab({
      base: h - 40,
      h: 40,
      w: run,
      d: d - run,
      x: w / 2 - run / 2,
      z: -run / 2,
      paint: body,
    }),
    slab({ x: -(w / 2 - 40), z: d / 2 - run / 2, h: h - 40, w: 80, d: run - 100, paint: frame }),
    slab({ x: w / 2 - run / 2, z: -(d / 2 - 40), h: h - 40, w: run - 100, d: 80, paint: frame }),
    slab({ x: w / 2 - 40, z: d / 2 - run / 2, h: h - 40, w: 80, d: run - 100, paint: frame }),
  ]
}

export const officeChair: Builder = ({ body, frame }) => [
  ...along(5, (i) => (i * 2 * Math.PI) / 5).map((turn) =>
    slab({
      x: Math.sin(turn) * 150,
      z: Math.cos(turn) * 150,
      h: 30,
      w: 60,
      d: 300,
      turn,
      paint: frame,
    }),
  ),
  ...along(5, (i) => (i * 2 * Math.PI) / 5).map((turn) =>
    drum({ x: Math.sin(turn) * 270, z: Math.cos(turn) * 270, r: 28, h: 40, paint: PAINT.dark }),
  ),
  drum({ r: 30, base: 30, h: 400, paint: frame }),
  slab({ base: 430, h: 90, w: 500, d: 500, paint: body }),
  lean({ from: [220, 520], to: [270, 1000], w: 460, thick: 60, paint: body }),
  ...[-270, 270].map((x) => slab({ x, base: 650, h: 30, w: 60, d: 300, paint: frame })),
]

export const poolTable: Builder = ({ w, d, h, body, frame }) => [
  slab({ h: h - 100, w: w - 200, d: d - 200, paint: frame }),
  slab({ base: h - 100, h: 100, w, d, paint: body }),
  slab({ base: h, h: 8, w: w - 260, d: d - 260, paint: PAINT.felt }),
]

export const pingPong: Builder = ({ w, d, h, frame }) => [
  slab({ base: h - 30, h: 30, w, d, paint: { colour: '#2c5aa0' } }),
  ...legs({ w, d, h: h - 30, inset: 200, thick: 40, paint: frame }),
  slab({ base: h, h: 150, w: w + 100, d: 10, paint: PAINT.porcelain }),
]

export const bar: Builder = (part) => {
  const { w, d, h, body } = part
  return [
    ...cabinet({ ...part, d: d - 60 }, 3, 1, h - 40),
    slab({ base: h - 40, h: 40, w: w + 40, d: d + 60, z: -40, paint: body }),
  ]
}
