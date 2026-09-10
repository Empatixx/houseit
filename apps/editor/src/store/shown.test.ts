import { beforeEach, expect, test } from 'vitest'
import { LAYERS, shownStore } from './shown'

beforeEach(() => shownStore.getState().showAll())

test('a plan is drawn whole until something is turned off', () => {
  for (const layer of LAYERS) expect(shownStore.getState().shown[layer.id]).toBe(true)
})

test('turning a layer off leaves the rest alone', () => {
  shownStore.getState().show('furniture', false)

  expect(shownStore.getState().shown.furniture).toBe(false)
  expect(shownStore.getState().shown.floors).toBe(true)
})

test('turning it back on draws it again', () => {
  shownStore.getState().show('grid', false)
  shownStore.getState().show('grid', true)

  expect(shownStore.getState().shown.grid).toBe(true)
})

test('every layer has a name to put beside its switch', () => {
  for (const layer of LAYERS) expect(layer.label.length).toBeGreaterThan(0)
})
