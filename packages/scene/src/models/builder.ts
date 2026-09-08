import type { Finish, Piece } from '../pieces'
import { slab } from '../pieces'

export type Part = {
  w: number
  d: number
  h: number
  body: Finish
  frame: Finish
}

export type Builder = (part: Part) => Piece[]

export function cabinet(part: Part, columns = 1, rows = 1, height = part.h): Piece[] {
  const { w, d, body, frame } = part
  const handles: Piece[] = []
  for (let c = 0; c < columns; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      handles.push(
        slab({
          x: -w / 2 + ((c + 0.5) * w) / columns,
          z: -d / 2 - 10,
          base: 60 + ((r + 0.5) * (height - 60)) / rows,
          h: 18,
          w: Math.min(160, w / columns - 80),
          d: 20,
          paint: frame,
        }),
      )
    }
  }
  return [
    slab({ h: 60, w: w - 80, d: d - 80, paint: frame }),
    slab({ base: 60, h: height - 60, w, d, paint: body }),
    ...handles,
  ]
}
