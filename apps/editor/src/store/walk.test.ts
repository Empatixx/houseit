import { expect, test } from 'vitest'
import { headingOf, walkStore, yawTowards } from './walk'

test('yaw is clockwise from north: north, then east', () => {
  expect(headingOf(0)).toEqual({ x: 0, y: 1 })
  const east = headingOf(Math.PI / 2)
  expect(east.x).toBeCloseTo(1)
  expect(east.y).toBeCloseTo(0)
})

test('the yaw towards a point to the east is a quarter turn', () => {
  expect(yawTowards({ x: 0, y: 0 }, { x: 1000, y: 0 })).toBeCloseTo(Math.PI / 2)
  expect(yawTowards({ x: 0, y: 0 }, { x: 0, y: -1000 })).toBeCloseTo(Math.PI)
})

test('the neck stops the head short of straight up', () => {
  const { place, look } = walkStore.getState()
  place({ x: 0, y: 0 })
  look(1, 4)
  expect(walkStore.getState().walker?.pitch).toBeCloseTo(1.3)
  expect(walkStore.getState().walker?.yaw).toBe(1)
})

test('nobody is moved before the walk has started', () => {
  walkStore.setState({ walker: null })
  walkStore.getState().step({ x: 5, y: 5 })
  expect(walkStore.getState().walker).toBeNull()
})

test('exploring an overview preserves its camera position and height above the building', () => {
  walkStore.getState().inspect({
    at: [30, 20, 40],
    target: [10, 5, -10],
    span: 50,
    orthographic: false,
  })
  walkStore.getState().explore()
  const state = walkStore.getState()
  expect(state.inspection).toBeNull()
  expect(state.movement).toBe('free')
  expect(state.walker?.at).toEqual({ x: 30000, y: -40000 })
  expect(state.walker?.height).toBe(18400)
  expect(state.walker?.yaw).toBeCloseTo(Math.atan2(-20, 50))
  expect(state.walker?.pitch).toBeCloseTo(Math.atan2(-15, Math.hypot(20, 50)))
})
