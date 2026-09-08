import { expect, test } from 'vitest'
import { PAINT } from '../finishes'
import { cabinet } from './builder'

const PART = { w: 1200, d: 600, h: 900, body: PAINT.wall, frame: PAINT.steel }

test('a cabinet is a plinth with a carcass on it', () => {
  const built = cabinet(PART, 1, 1)

  expect(built.slice(0, 2).map((piece) => piece.at.y)).toEqual([30, 480])
})

test('a cabinet grows a handle for every door and every drawer', () => {
  expect(cabinet(PART, 3, 1)).toHaveLength(2 + 3)
  expect(cabinet(PART, 2, 4)).toHaveLength(2 + 8)
})

test('a handle stands off the front, because nothing on a vertical face can be seen from above', () => {
  const handles = cabinet(PART, 2, 1).slice(2)

  expect(handles.every((handle) => handle.at.z < -PART.d / 2)).toBe(true)
})

test('handles share the width out between the doors and never touch', () => {
  const handles = cabinet(PART, 3, 1).slice(2)

  expect(handles.map((handle) => handle.at.x)).toEqual([-400, 0, 400])
  for (const handle of handles) {
    expect(handle.body).toMatchObject({ width: Math.min(160, PART.w / 3 - 80) })
  }
})
