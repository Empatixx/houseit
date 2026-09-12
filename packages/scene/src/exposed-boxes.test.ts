import { expect, test } from 'vitest'
import { exposedBoxes } from './exposed-boxes'
import { type Piece, slab } from './pieces'

function skinArea(pieces: Piece[]) {
  return pieces.reduce((sum, piece) => {
    if (piece.body.kind !== 'box') throw Error('box expected')
    const points = piece.body.faces!
    for (let i = 0; i < points.length; i += 9) {
      const u = [0, 1, 2].map((j) => points[i + 3 + j]! - points[i + j]!)
      const v = [0, 1, 2].map((j) => points[i + 6 + j]! - points[i + j]!)
      sum +=
        Math.hypot(
          u[1]! * v[2]! - u[2]! * v[1]!,
          u[2]! * v[0]! - u[0]! * v[2]!,
          u[0]! * v[1]! - u[1]! * v[0]!,
        ) / 2
    }
    return sum
  }, 0)
}
const paint = { colour: '#ffffff' }

test('crossing walls expose one cross-shaped skin, without internal or coincident faces', () => {
  const pieces = exposedBoxes([
    slab({ w: 4, h: 3, d: 1, paint }),
    slab({ w: 4, h: 3, d: 1, turn: Math.PI / 2, paint }),
  ])
  expect(skinArea(pieces)).toBeCloseTo(62)
})

test('touching solids lose both sides of their shared face', () => {
  expect(
    skinArea(
      exposedBoxes([slab({ w: 2, h: 2, d: 2, paint }), slab({ x: 2, w: 2, h: 2, d: 2, paint })]),
    ),
  ).toBeCloseTo(40)
})

test('coincident surfaces keep the first finish, including embedded columns', () => {
  const first = slab({ w: 2, h: 2, d: 2, paint })
  const pieces = exposedBoxes([first, { ...first, paint: { colour: '#ff0000' } }])
  expect(skinArea(pieces)).toBeCloseTo(24)
  expect(pieces[1]!.body.kind === 'box' && pieces[1]!.body.faces).toEqual([])
})
