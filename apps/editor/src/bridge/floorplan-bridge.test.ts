import { expect, test } from 'vitest'
import { createDocumentStore } from '../store/document-store'
import { selectionStore } from '../store/selection'
import { viewStore } from '../store/view'
import { installFloorplanBridge } from './floorplan-bridge'

const floor =
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name dům'

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

test('exec hands back what describe and measure said', () => {
  const bridge = bridgeOn()
  bridge.exec(floor)

  const result = bridge.exec('describe --room dům')

  expect(result.ok && result.output).toHaveLength(1)
  expect(result.ok && result.output[0]).toMatchObject({ name: 'dům' })
})

test('showing a room picks it and frames it, with room to spare round it', () => {
  const bridge = bridgeOn()
  bridge.exec(floor)

  expect(bridge.show({ room: 'dům' })).toEqual({ ok: true })

  expect(selectionStore.getState().selected).toMatchObject({ kind: 'room' })
  const box = viewStore.getState().box
  expect(box).not.toBeNull()
  expect(box!.x0).toBeLessThan(0)
  expect(box!.x1).toBeGreaterThan(12_000)
})

test('showing a thing picks the last one of its type in the room', () => {
  const bridge = bridgeOn()
  bridge.exec(`${floor}\nadd-object --room dům --type sofa-3 --against south`)

  expect(bridge.show({ room: 'dům', type: 'sofa-3' })).toEqual({ ok: true })

  expect(selectionStore.getState().selected).toMatchObject({ kind: 'object' })
})

test('showing the level lets go of whatever was picked and frames the plan', () => {
  const bridge = bridgeOn()
  bridge.exec(floor)
  bridge.show({ room: 'dům' })

  expect(bridge.show({ dimensions: true })).toEqual({ ok: true })

  expect(selectionStore.getState().selected).toBeNull()
  expect(selectionStore.getState().showAll).toBe(true)
  expect(viewStore.getState().box).toBeNull()
})

test('showing what is not there is refused by name, not thrown', () => {
  const bridge = bridgeOn()
  bridge.exec(floor)

  expect(bridge.show({ room: 'attic' })).toEqual({
    ok: false,
    error: expect.stringMatching(/attic/),
  })
  expect(bridge.show({ room: 'dům', type: 'sofa-3' })).toMatchObject({ ok: false })
})

test('help lists the commands an agent may use', () => {
  expect(bridgeOn().help()).toMatch(/floor-shape/)
})
