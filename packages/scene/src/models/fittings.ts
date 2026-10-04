import { PAINT } from '../finishes'
import { along, slab } from '../pieces'
import type { Builder } from './builder'

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
