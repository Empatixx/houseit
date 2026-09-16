import { lighter } from '../finishes'
import { along, type Finish, lean, legs, model, type Piece, put, slab } from '../pieces'
import type { Builder, Part } from './builder'

export const sofa: Builder = ({ w, d, body, frame }) => {
  const arm = Math.min(200, w * 0.12)
  const back = 200
  const seats = w > 2000 ? 3 : w > 1300 ? 2 : 1
  const inner = w - 2 * arm
  const gap = 20
  const cushionW = (inner - gap * (seats + 1)) / seats
  const cushionD = d - back - 60
  const cushion = lighter(body, 0.08)
  return [
    ...legs({ w: w - 60, d: d - 60, h: 90, thick: 50, inset: 0, paint: frame }),
    slab({ base: 90, h: 280, w, d: d - back, z: -back / 2, paint: body }),
    slab({ base: 90, h: 720, w, d: back, z: d / 2 - back / 2, paint: body }),
    ...[-(w / 2 - arm / 2), w / 2 - arm / 2].map((x) =>
      slab({ x, base: 90, h: 520, w: arm, d: d - 40, z: -20, paint: body }),
    ),
    ...along(seats, (i) => -inner / 2 + gap + cushionW / 2 + i * (cushionW + gap)).flatMap((x) => [
      slab({ x, base: 370, h: 150, w: cushionW, d: cushionD, z: -back / 2 - 10, paint: cushion }),
      lean({
        x,
        from: [d / 2 - back - 40, 520],
        to: [d / 2 - back + 60, 900],
        w: cushionW - 10,
        thick: 140,
        paint: cushion,
      }),
    ]),
  ]
}

export const sofaL: Builder = (part) => {
  const { w, d, body, frame } = part
  const run = Math.min(965, d)
  const chaise = { x: -(w / 2 - run / 2), z: -run / 2, d: d - run }
  return [
    ...put({ z: d / 2 - run / 2 }, sofa({ ...part, d: run })),
    ...legs({
      x: chaise.x,
      z: chaise.z,
      w: run - 60,
      d: chaise.d - 60,
      h: 90,
      thick: 50,
      inset: 0,
      paint: frame,
    }),
    slab({ x: chaise.x, z: chaise.z, base: 90, h: 280, w: run, d: chaise.d, paint: body }),
    slab({
      x: chaise.x,
      z: chaise.z,
      base: 370,
      h: 150,
      w: run - 40,
      d: chaise.d - 20,
      paint: lighter(body, 0.08),
    }),
    slab({
      x: chaise.x - run / 2 + 100,
      z: chaise.z,
      base: 90,
      h: 520,
      w: 200,
      d: chaise.d,
      paint: body,
    }),
  ]
}

export const chairOttoman: Builder = (part) => {
  const { w, d, body } = part
  const seat = Math.min(838, d * 0.6)
  return [
    ...put({ z: d / 2 - seat / 2 }, sofa({ ...part, d: seat })),
    slab({
      z: -(d / 2) + (d - seat - 100) / 2,
      h: 400,
      w: w - 120,
      d: d - seat - 100,
      paint: body,
    }),
  ]
}

export const bench: Builder = ({ w, d, body, frame }) => [
  slab({ base: 400, h: 50, w, d, paint: body }),
  ...legs({ w, d, h: 400, thick: 40, paint: frame }),
]

function table({ w, d, h, body, frame }: Part, inset = 0): Piece[] {
  return [
    slab({ base: h - 40, h: 40, w: w - 2 * inset, d: d - 2 * inset, paint: body }),
    ...legs({ w: w - 2 * inset, d: d - 2 * inset, h: h - 40, paint: frame }),
  ]
}

export const plainTable: Builder = (part) => table(part)

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
