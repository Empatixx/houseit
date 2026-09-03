import { expect, test } from 'vitest'
import { clearOf, viewStore } from './view'

const canvas = { width: 1000, height: 600 }

test('nothing floating over the plan leaves the whole canvas clear', () => {
  expect(clearOf({}, canvas)).toEqual({ x: 0, y: 0, width: 1000, height: 600 })
})

test('what floats over the plan is taken off the edge it hangs on', () => {
  const covers = {
    panel: { edge: 'right' as const, extent: 268 },
    cards: { edge: 'top' as const, extent: 52 },
    bar: { edge: 'bottom' as const, extent: 64 },
  }
  expect(clearOf(covers, canvas)).toEqual({ x: 0, y: 52, width: 732, height: 484 })
})

test('two things on one edge count once, by the one that reaches further', () => {
  const covers = {
    near: { edge: 'right' as const, extent: 100 },
    far: { edge: 'right' as const, extent: 268 },
  }
  expect(clearOf(covers, canvas).width).toBe(732)
})

test('a canvas covered right across is still a pixel, not nothing', () => {
  expect(clearOf({ wall: { edge: 'left', extent: 5000 } }, canvas).width).toBe(1)
})

test('covering is remembered by who covers, and taken back by them', () => {
  const { cover } = viewStore.getState()
  cover('panel', { edge: 'right', extent: 268 })
  expect(viewStore.getState().covers.panel).toEqual({ edge: 'right', extent: 268 })
  cover('panel', null)
  expect(viewStore.getState().covers.panel).toBeUndefined()
})
