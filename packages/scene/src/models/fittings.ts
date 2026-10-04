import { PAINT } from '../finishes'
import { along, slab } from '../pieces'
import type { Builder } from './builder'

const PLINTH = 90
const CAPITAL = 70
const NECK = 20

export const column: Builder = ({ w, d, h }) => {
  const shaft = { w: Math.max(40, w - 50), d: Math.max(40, d - 50) }
  const neck = { w: shaft.w + 16, d: shaft.d + 16 }
  return [
    slab({ h: PLINTH, w, d, paint: PAINT.wall }),
    slab({ base: PLINTH, h: NECK, w: neck.w, d: neck.d, paint: PAINT.wall }),
    slab({ base: PLINTH, h: h - PLINTH - CAPITAL, w: shaft.w, d: shaft.d, paint: PAINT.wall }),
    slab({ base: h - CAPITAL - NECK, h: NECK, w: neck.w, d: neck.d, paint: PAINT.wall }),
    slab({ base: h - CAPITAL, h: CAPITAL, w, d, paint: PAINT.wall }),
  ]
}

const POST = 44
const RAIL = { width: 56, height: 44 }
const SHOE = 30

export const railing: Builder = ({ w, d, h, frame }) => {
  const bays = Math.max(1, Math.round(w / 900))
  const posts = along(bays + 1, (i) => -w / 2 + POST / 2 + (i * (w - POST)) / bays)
  const bay = (w - POST) / bays
  const thick = Math.max(d, RAIL.width)
  return [
    ...posts.flatMap((x) => [
      slab({ x, h: 12, w: POST + 40, d: Math.min(thick, POST + 40), paint: frame }),
      slab({ x, h: h - RAIL.height, w: POST, d: POST, paint: frame }),
    ]),
    slab({ base: h - RAIL.height, h: RAIL.height, w, d: thick, paint: frame }),
    slab({ base: 60, h: SHOE, w: w - POST, d: Math.min(thick, 40), paint: frame }),
    ...along(bays, (i) => -w / 2 + POST + bay * (i + 0.5) - POST / 2).flatMap((x) => [
      slab({
        x,
        base: 60 + SHOE,
        h: h - RAIL.height - 60 - SHOE - 40,
        w: bay - POST - 30,
        d: 12,
        paint: PAINT.glass,
      }),
      ...[-1, 1].flatMap((side) =>
        [0.25, 0.75].map((up) =>
          slab({
            x: x + side * ((bay - POST - 30) / 2 + 2),
            base: 60 + SHOE + up * (h - RAIL.height - 60 - SHOE - 40) - 25,
            h: 50,
            w: 22,
            d: 26,
            paint: frame,
          }),
        ),
      ),
    ]),
  ]
}
