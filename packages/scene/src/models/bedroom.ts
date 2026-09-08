import { lighter, PAINT } from '../finishes'
import { along, drum, type Finish, legs, slab } from '../pieces'
import { type Builder, cabinet } from './builder'

export const bed: Builder = ({ w, d, body, frame }) => {
  const two = w > 1200
  const pillowLine = d / 2 - 620
  return [
    ...legs({ w: w - 40, d: d - 40, h: 100, thick: 70, inset: 0, paint: frame }),
    slab({ base: 100, h: 250, w, d, paint: frame }),
    slab({ base: 350, h: 200, w: w - 60, d: d - 60, paint: PAINT.porcelain }),
    slab({
      base: 550,
      h: 50,
      w: w + 30,
      d: pillowLine + d / 2 - 40,
      z: (pillowLine - d / 2 + 40) / 2,
      paint: body,
    }),
    slab({ base: 600, h: 60, w: w + 30, d: 220, z: pillowLine - 110, paint: lighter(body, 0.12) }),
    ...(two ? [-w / 4, w / 4] : [0]).flatMap((x) => [
      slab({
        x,
        base: 550,
        h: 80,
        w: two ? w / 2 - 160 : w - 200,
        d: 440,
        z: d / 2 - 330,
        paint: PAINT.porcelain,
      }),
      slab({
        x,
        base: 630,
        h: 70,
        w: two ? w / 2 - 220 : w - 260,
        d: 400,
        z: d / 2 - 330,
        paint: PAINT.porcelain,
      }),
    ]),
    slab({ h: 1050, w: w + 60, d: 70, z: d / 2 - 35, paint: frame }),
    slab({ base: 420, h: 560, w: w - 20, d: 30, z: d / 2 - 85, paint: lighter(body, 0.05) }),
  ]
}

export const crib: Builder = ({ w, d, body, frame }) => [
  ...legs({ w, d, h: 900, inset: 0, thick: 40, paint: frame }),
  slab({ base: 300, h: 60, w, d, paint: frame }),
  slab({ base: 360, h: 140, w: w - 60, d: d - 60, paint: PAINT.porcelain }),
  slab({ base: 500, h: 30, w: w - 100, d: d - 300, z: -100, paint: body }),
  slab({ base: 870, h: 30, w, d, paint: frame }),
  ...[-(d / 2 - 15), d / 2 - 15].flatMap((z) =>
    along(Math.floor((w - 80) / 90), (i) => -w / 2 + 85 + i * 90).map((x) =>
      slab({ x, z, base: 360, h: 510, w: 16, d: 16, paint: frame }),
    ),
  ),
  ...[-(w / 2 - 15), w / 2 - 15].flatMap((x) =>
    along(Math.floor((d - 80) / 90), (i) => -d / 2 + 85 + i * 90).map((z) =>
      slab({ x, z, base: 360, h: 510, w: 16, d: 16, paint: frame }),
    ),
  ),
]

export const nightstand: Builder = (part) => cabinet(part, 1, 1)
export const dresser: Builder = (part) => cabinet(part, 2, 3)
export const credenza: Builder = (part) => cabinet(part, 3, 1)
export const filing: Builder = (part) => cabinet(part, 1, 3)
export const plainBox: Builder = (part) => cabinet(part, 1, 1)

export const mediaUnit: Builder = (part) => {
  const { w, d, h } = part
  const screen = Math.min(1300, w * 0.8)
  return [
    ...cabinet(part, 2, 1),
    slab({ base: h, h: 60, w: 300, d: 200, z: d / 2 - 120, paint: PAINT.dark }),
    slab({ base: h + 60, h: screen * 0.56, w: screen, d: 30, z: d / 2 - 120, paint: PAINT.black }),
  ]
}

const BOOK_PAINTS: Finish[] = [
  { colour: '#8b4a3c' },
  { colour: '#3d5a80' },
  { colour: '#e0c78a' },
  { colour: '#4f6d4a' },
  { colour: '#d9d4cc' },
  { colour: '#6b4c7a' },
]

export const bookshelf: Builder = ({ w, d, h, body }) => {
  const shelves = Math.max(2, Math.round(h / 380))
  const pitch = h / shelves
  const columns = Math.max(2, Math.floor((w - 100) / 70))
  return [
    ...[-(w / 2 - 12), w / 2 - 12].map((x) => slab({ x, h, w: 25, d, paint: body })),
    slab({ h, w, d: 15, z: d / 2 - 8, paint: body }),
    ...along(shelves + 1, (i) => Math.min(i * pitch, h - 25)).map((base) =>
      slab({ base, h: 25, w: w - 50, d: d - 15, z: -7, paint: body }),
    ),
    ...along(shelves, (row) => row * pitch + 25).flatMap((base) =>
      along(columns, (i) => -w / 2 + 60 + i * 70).map((x) => {
        const nth = Math.round((x + w / 2) / 70 + base / pitch)
        return slab({
          x,
          z: -4,
          base,
          h: pitch - 65 - (nth % 3) * 40,
          w: 50,
          d: d - 60,
          paint: BOOK_PAINTS[nth % BOOK_PAINTS.length]!,
        })
      }),
    ),
  ]
}

export const clothingRack: Builder = ({ w, d, h, frame }) => [
  ...[-(w / 2 - 30), w / 2 - 30].map((x) => slab({ x, h, w: 30, d: 30, paint: frame })),
  ...[-(w / 2 - 30), w / 2 - 30].map((x) => slab({ x, h: 30, w: 30, d, paint: frame })),
  slab({ base: h - 30, h: 30, w, d: 30, paint: frame }),
  ...along(Math.floor((w - 120) / 130), (i) => -w / 2 + 90 + i * 130).map((x) =>
    slab({
      x,
      base: h - 900,
      h: 870,
      w: 60,
      d: d * 0.7,
      paint: BOOK_PAINTS[Math.round((x + w / 2) / 130) % BOOK_PAINTS.length]!,
    }),
  ),
]

export const coatStand: Builder = ({ h, frame }) => [
  drum({ r: 180, h: 25, paint: frame }),
  drum({ r: 18, base: 25, h: h - 25, paint: frame }),
  ...[0, 1, 2, 3].map((i) =>
    slab({ base: h - 120, h: 20, w: 220, d: 20, turn: (i * Math.PI) / 4, paint: frame }),
  ),
]

export const consoleMirror: Builder = ({ w, d, body, frame }) => [
  slab({ base: 810, h: 40, w, d, paint: body }),
  ...legs({ w, d, h: 810, thick: 40, paint: frame }),
  slab({ base: 950, h: 800, w: w * 0.8, d: 20, z: d / 2 - 10, paint: PAINT.mirror }),
]
