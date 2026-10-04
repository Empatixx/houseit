import { lighter } from '../finishes'
import { type Finish, model, type Piece, put } from '../pieces'
import type { Builder } from './builder'

const chair = (body: Finish): Piece[] => [
  model({ file: 'dining-chair-classic.glb', w: 440, d: 460, h: 940, paint: body }),
]

function seats(w: number, d: number, long: number, ends: number): [number, number, number][] {
  const out: [number, number, number][] = []
  const near = 230
  for (let i = 0; i < long; i += 1) {
    const z = ((i + 0.5) / long - 0.5) * (d - 460)
    out.push([w / 2 - near, z, Math.PI / 2], [-(w / 2 - near), z, -Math.PI / 2])
  }
  for (let i = 0; i < ends; i += 1) {
    const x = ((i + 0.5) / ends - 0.5) * (w - 460)
    out.push([x, -(d / 2 - near), Math.PI], [x, d / 2 - near, 0])
  }
  return out
}

export function dining(long: number, ends: number, round = false): Builder {
  return (part) => {
    const { w, d, h, body } = part
    const top = round
      ? [
          model({
            file: 'table-round.glb',
            w: Math.min(w, d) - 700,
            d: Math.min(w, d) - 700,
            h,
            paint: body,
          }),
        ]
      : put({ turn: Math.PI / 2 }, [
          model({ file: 'table-rectangular.glb', w: d - 700, d: w - 700, h, paint: body }),
        ])
    return [
      ...top,
      ...seats(w, d, long, ends).flatMap(([x, z, turn]) =>
        put({ x, z, turn }, chair(lighter(body, 0.2))),
      ),
    ]
  }
}
