import { IDBFactory as FakeIndexedDb } from 'fake-indexeddb'
import { expect, test } from 'vitest'
import { createDocumentStore } from '../store/document-store'
import { openProjects } from '../store/projects/db'
import { createProjectsStore } from '../store/projects/projects'
import { selectionStore } from '../store/selection'
import { viewStore } from '../store/view'
import { installFloorplanBridge } from './floorplan-bridge'

const floor = 'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name dům'

async function bridgeOn(store = createDocumentStore()) {
  const projects = createProjectsStore(() => openProjects(new FakeIndexedDb()), store)
  installFloorplanBridge(store, projects)
  const meta = await projects.getState().create('Byt')
  await projects.getState().openProject(meta.id)
  return window.floorplan
}

async function bridgeWithNothingOpen() {
  const store = createDocumentStore()
  const projects = createProjectsStore(() => openProjects(new FakeIndexedDb()), store)
  await projects.getState().create('Byt')
  await projects.getState().refresh()
  installFloorplanBridge(store, projects)
  return window.floorplan
}

test('installs itself on window so the MCP server can find it', async () => {
  expect(typeof (await bridgeOn()).exec).toBe('function')
})

test('exec reports the rooms the command produced', async () => {
  const result = (await bridgeOn()).exec(floor)

  expect(result.ok).toBe(true)
  expect(result.ok && result.rooms).toEqual([{ name: 'dům', area: 12_000 * 9000 }])
})

test('exec returns the failure as data rather than throwing across the boundary', async () => {
  const result = (await bridgeOn()).exec('no-such-command')

  expect(result.ok).toBe(false)
  expect(result.ok === false && result.error).toMatch(/no-such-command/)
})

test('a failed exec leaves the plan alone', async () => {
  const bridge = await bridgeOn()
  bridge.exec(floor)

  bridge.exec('no-such-command')

  expect(bridge.getPlan().rooms).toHaveLength(1)
})

test('getPlan reports the document and its derived rooms', async () => {
  const bridge = await bridgeOn()
  bridge.exec(floor)

  const plan = bridge.getPlan()

  expect(plan.rooms).toEqual([{ name: 'dům', area: 12_000 * 9000 }])
  expect(Object.keys(plan.document.walls)).toHaveLength(4)
})

test('every exec answers with the rooms it touched and what is wrong with the plan', async () => {
  const bridge = await bridgeOn()
  bridge.exec(floor)

  const result = bridge.exec('get-plan --room dům')

  expect(result.ok && result.answer.rooms).toHaveLength(1)
  expect(result.ok && result.answer.rooms[0]).toMatchObject({ name: 'dům' })
  expect(result.ok && result.answer.problems.map((it) => it.code)).toContain('house.no-entrance')
})

test('a change answers the same way, and names what it changed', async () => {
  const bridge = await bridgeOn()
  bridge.exec(floor)

  const result = bridge.exec('add-object --room dům --type sofa-3 --against south')

  expect(result.ok && result.answer.changed).toHaveLength(1)
  expect(result.ok && result.answer.rooms[0]?.objects).toHaveLength(1)
  const south = result.ok ? result.answer.rooms[0]!.sides.find((it) => it.side === 'south') : null
  expect(south?.objects).toHaveLength(1)
  expect(south?.free.length).toBeGreaterThan(0)
})

test('showing a room picks it and frames it, with room to spare round it', async () => {
  const bridge = await bridgeOn()
  bridge.exec(floor)

  expect(bridge.show({ room: 'dům' })).toEqual({ ok: true })

  expect(selectionStore.getState().selected).toMatchObject({ kind: 'room' })
  const box = viewStore.getState().box
  expect(box).not.toBeNull()
  expect(box!.x0).toBeLessThan(0)
  expect(box!.x1).toBeGreaterThan(12_000)
})

test('showing a thing picks it out by the id the answer gave', async () => {
  const bridge = await bridgeOn()
  const result = bridge.exec(`${floor}\nadd-object --room dům --type sofa-3 --against south`)
  const sofa = result.ok ? result.answer.changed.find((id) => id.startsWith('f'))! : ''

  expect(bridge.show({ room: 'dům', object: sofa })).toMatchObject({ ok: true })

  expect(selectionStore.getState().selected).toMatchObject({ kind: 'object' })
})

test('what is in the way is asked for after the framing, not reported with it', async () => {
  const bridge = await bridgeOn()
  bridge.exec(floor)

  expect(bridge.show({ room: 'dům' })).toEqual({ ok: true })

  expect(bridge.clear().x).toBe(0)

  viewStore.getState().cover('rail', { edge: 'left', extent: 60 })
  expect(bridge.clear().x).toBe(60)
  viewStore.getState().cover('rail', null)
})

test('showing the level lets go of whatever was picked and frames the plan', async () => {
  const bridge = await bridgeOn()
  bridge.exec(floor)
  bridge.show({ room: 'dům' })

  expect(bridge.show({ dimensions: true })).toMatchObject({ ok: true })

  expect(selectionStore.getState().selected).toBeNull()
  expect(selectionStore.getState().showAll).toBe(true)
  expect(viewStore.getState().box).toBeNull()
})

test('showing what is not there is refused by name, not thrown', async () => {
  const bridge = await bridgeOn()
  bridge.exec(floor)

  expect(bridge.show({ room: 'attic' })).toEqual({
    ok: false,
    error: expect.stringMatching(/attic/),
  })
  expect(bridge.show({ room: 'dům', object: 'f9' })).toMatchObject({ ok: false })
})

test('help lists the commands an agent may use', async () => {
  expect((await bridgeOn()).help()).toMatch(/add-room/)
})

test('with no project open there is nothing to work on, and it says which there are', async () => {
  const bridge = await bridgeWithNothingOpen()

  const result = bridge.exec(floor)

  expect(result.ok).toBe(false)
  expect(result.ok === false && result.error).toMatch(/no project open/)
  expect(result.ok === false && result.error).toMatch(/byt/)
})

test('with no project open nothing is framed either', async () => {
  const bridge = await bridgeWithNothingOpen()

  expect(bridge.show({})).toMatchObject({ ok: false })
})

test('the snapshot says which project the plan belongs to', async () => {
  const bridge = await bridgeOn()

  expect(bridge.getPlan().project).toEqual({ id: 'byt', name: 'Byt' })
  expect(bridge.exec(floor)).toMatchObject({ project: { name: 'Byt' } })
})
