import { expect, test } from 'vitest'
import { createDocumentStore } from '../store/document-store'
import { installFloorplanBridge } from './floorplan-bridge'

const floor = 'floor-shape --kind rectangle --width 12m --depth 9m --name dům'

const bridgeOn = (store = createDocumentStore()) => {
  installFloorplanBridge(store)
  return window.floorplan
}

test('installs itself on window so the MCP server can find it', () => {
  expect(typeof bridgeOn().exec).toBe('function')
})

test('exec reports the rooms the command produced', () => {
  const result = bridgeOn().exec(floor)

  expect(result.ok).toBe(true)
  expect(result.ok && result.rooms).toEqual([{ name: 'dům', area: 12_000 * 9000 }])
})

test('exec returns the failure as data rather than throwing across the boundary', () => {
  const result = bridgeOn().exec('no-such-command')

  expect(result.ok).toBe(false)
  expect(result.ok === false && result.error).toMatch(/no-such-command/)
})

test('a failed exec leaves the plan alone', () => {
  const bridge = bridgeOn()
  bridge.exec(floor)

  bridge.exec('no-such-command')

  expect(bridge.getPlan().rooms).toHaveLength(1)
})

test('getPlan reports the document and its derived rooms', () => {
  const bridge = bridgeOn()
  bridge.exec(floor)

  const plan = bridge.getPlan()

  expect(plan.rooms).toEqual([{ name: 'dům', area: 12_000 * 9000 }])
  expect(Object.keys(plan.document.walls)).toHaveLength(4)
})

test('help lists the commands an agent may use', () => {
  expect(bridgeOn().help()).toMatch(/floor-shape/)
})
