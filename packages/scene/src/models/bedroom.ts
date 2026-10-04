import { PAINT } from '../finishes'
import { model, put, slab } from '../pieces'
import type { Builder } from './builder'

export const plainBox: Builder = ({ w, h, d, body }) => [slab({ w, h, d, paint: body })]

export const mediaUnit: Builder = (part) => {
  const { w, d, h } = part
  const screen = Math.min(1300, w * 0.8)
  return [
    model({ file: 'tv-stand-wood.glb', w, d, h, paint: part.body }),
    ...put({ y: h, z: d / 2 - 120 }, [
      model({
        file: 'television-flat.glb',
        w: screen,
        h: (screen * 746) / 1120,
        d: 225,
        paint: PAINT.black,
      }),
    ]),
  ]
}
