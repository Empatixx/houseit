import { expect, test } from 'vitest'
import { ball, disc, drum, lean, legs, put, slab } from './pieces'

const WHITE = { colour: '#ffffff' }

test('a slab stands on its base, so its middle is half its height up', () => {
  const piece = slab({ w: 600, h: 900, d: 400, paint: WHITE })

  expect(piece.body).toEqual({ kind: 'box', width: 600, height: 900, depth: 400 })
  expect(piece.at).toEqual({ x: 0, y: 450, z: 0 })
})

test('a drum stands on its base the way a slab does', () => {
  const piece = drum({ r: 150, h: 300, base: 700, paint: WHITE })

  expect(piece.at.y).toBe(850)
})

test('a drum is a cylinder unless it is given a narrower top', () => {
  expect(drum({ r: 240, h: 300, paint: WHITE }).body).toEqual({
    kind: 'drum',
    radius: 240,
    top: 240,
    height: 300,
    open: false,
    stretch: 1,
  })

  const shade = drum({ r: 240, top: 140, h: 300, open: true, paint: WHITE })
  expect(shade.body).toMatchObject({ radius: 240, top: 140, open: true })
})

test('a ball hangs at its middle, because a sphere has no base to stand on', () => {
  const piece = ball({ y: 1200, r: 340, paint: WHITE })

  expect(piece.body).toEqual({ kind: 'ball', radius: 340 })
  expect(piece.at).toEqual({ x: 0, y: 1200, z: 0 })
})

test('a disc lies on its face, and turned aside it stands on its edge', () => {
  expect(disc({ y: 300, r: 200, thick: 40, paint: WHITE })).toMatchObject({
    tilt: Math.PI / 2,
    roll: 0,
  })

  expect(disc({ y: 300, r: 200, thick: 40, facing: 'side', paint: WHITE })).toMatchObject({
    tilt: 0,
    roll: Math.PI / 2,
  })
})

test('a lean is as long as the run it spans and tilts to meet both ends', () => {
  const piece = lean({ from: [0, 0], to: [300, 400], w: 900, thick: 40, paint: WHITE })

  expect(piece.body).toEqual({ kind: 'box', width: 900, height: 500, depth: 40 })
  expect(piece.at).toEqual({ x: 0, y: 200, z: 150 })
  expect(piece.tilt).toBeCloseTo(Math.atan2(300, 400))
})

test('legs stand at the four corners, inset from the edge', () => {
  const four = legs({ w: 1000, d: 600, h: 400, inset: 60, thick: 50, paint: WHITE })

  expect(four).toHaveLength(4)
  expect(new Set(four.map((leg) => leg.at.x))).toEqual(new Set([-415, 415]))
  expect(new Set(four.map((leg) => leg.at.z))).toEqual(new Set([-215, 215]))
  expect(four.every((leg) => leg.at.y === 200)).toBe(true)
})

test('put shifts everything under it', () => {
  const [moved] = put({ x: 1000, z: -400 }, [slab({ w: 10, h: 10, d: 10, paint: WHITE })])

  expect(moved?.at).toEqual({ x: 1000, y: 5, z: -400 })
})

test('put turns where a thing stands, not only which way it faces', () => {
  const [swung] = put({ turn: Math.PI / 2 }, [slab({ x: 100, w: 10, h: 10, d: 10, paint: WHITE })])

  expect(swung?.at.x).toBeCloseTo(0)
  expect(swung?.at.z).toBeCloseTo(-100)
})

test('a thing already turned keeps its own turn on top of the one it is put under', () => {
  const [twice] = put({ turn: 0.5 }, [slab({ turn: 0.25, w: 10, h: 10, d: 10, paint: WHITE })])

  expect(twice?.turn).toBeCloseTo(0.75)
})
