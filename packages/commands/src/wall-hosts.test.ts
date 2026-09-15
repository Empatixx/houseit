import { createEmptyDocument, type HouseDocument, parseDocument } from '@houseit/core/document'
import { wallHosts } from '@houseit/core/wall-hosts'
import { roomsOf } from '@houseit/geometry/rooms'
import { standingAt } from '@houseit/geometry/standing'
import { applyPatches } from 'immer'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScriptWithPatches } from './patches'
import { runScript } from './run'

const room = () =>
  runScript(
    createEmptyDocument(),
    'add-room --shape rectangle --width 8m --depth 6m --name Room --material natural-oak',
  )
const position = (doc: HouseDocument, id: string) => {
  const object = doc.objects[id]!
  return standingAt(
    doc,
    object.level,
    roomsOf(doc, object.level).find((r) => r.id === object.room)!,
    object,
  )!.at
}
const north = (doc: HouseDocument) =>
  askPlan(doc, 'get-plan').walls.find((w) => w.from.y === 6000 && w.to.y === 6000)!
const northBy = (doc: HouseDocument, mm: number) =>
  `update-wall --id ${north(doc).id} --by ${north(doc).to.x > north(doc).from.x ? mm : -mm}`
const hostPosition = (doc: HouseDocument, id: string) => {
  const host = wallHosts(doc).find((h) => h.id === id)!.host,
    w = doc.walls[host.wall]!,
    a = doc.nodes[w.a]!,
    b = doc.nodes[w.b]!
  return { x: a.x + (b.x - a.x) * host.t, y: a.y + (b.y - a.y) * host.t, z: w.baseOffset + host.z }
}

test('free furniture stays in world coordinates when its room grows', () => {
  const doc = runScript(
    room(),
    'add-object --room Room --type dining-round-4 --along 0.5 --across 0.5',
  )
  const before = position(doc, 'f1')
  const next = runScript(doc, northBy(doc, 500))
  expect(position(next, 'f1').x).toBeCloseTo(before.x, 6)
  expect(position(next, 'f1').y).toBeCloseTo(before.y, 6)
})

test('wall furniture follows its supporting wall and its changed thickness', () => {
  const doc = runScript(room(), 'add-object --room Room --type sofa-3 --against north --along 0.5')
  const before = position(doc, 'f1')
  const next = runScript(doc, `${northBy(doc, 500)} --thickness 500`)
  expect(position(next, 'f1').x).toBeCloseTo(before.x, 6)
  expect(position(next, 'f1').y).toBeCloseTo(before.y + 400, 6)
})

test('furniture beside a stretching wall keeps its distance along that wall', () => {
  const doc = runScript(room(), 'add-object --room Room --type sofa-3 --against east --along 0.5')
  const before = position(doc, 'f1')
  const next = runScript(doc, northBy(doc, 500))
  expect(position(next, 'f1').x).toBeCloseTo(before.x, 6)
  expect(position(next, 'f1').y).toBeCloseTo(before.y, 6)
})

test('a wall move cannot bury free furniture and restores the entire transaction on refusal', () => {
  const doc = runScript(
    room(),
    'add-object --room Room --type dining-round-4 --along 0.5 --across 0.5',
  )
  const snapshot = JSON.stringify(doc)
  expect(() => runScript(doc, northBy(doc, -3000))).toThrow(/f1/)
  expect(JSON.stringify(doc)).toBe(snapshot)
})

test('undo restores furniture fractions, host positions and the wall together', () => {
  let doc = runScript(
    room(),
    'add-object --room Room --type dining-round-4 --along 0.5 --across 0.5',
  )
  doc = runScript(doc, `add-device --kind socket --wall ${north(doc).id} --along 1500 --height 350`)
  const result = runScriptWithPatches(doc, northBy(doc, 500))
  expect(applyPatches(result.doc, result.inversePatches)).toEqual(doc)
  expect(applyPatches(doc, result.patches)).toEqual(result.doc)
})

const standalone = () =>
  runScript(
    createEmptyDocument(),
    `add-wall --from '{"x":0,"y":0}' --to '{"x":6000,"y":0}'\nadd-device --kind socket --wall w1 --along 4500 --height 350`,
  )

test('splitting and simplifying a wall retain electrical host position and stable readback', () => {
  const start = standalone()
  const split = runScript(start, `add-wall --from '{"x":3000,"y":0}' --to '{"x":3000,"y":4000}'`)
  expect(hostPosition(split, 'd1')).toEqual(hostPosition(start, 'd1'))
  const partition = askPlan(split, 'get-plan').walls.find((w) => w.id !== 'w1')!
  const merged = runScript(split, `remove-wall --id ${partition.id}`)
  expect(hostPosition(merged, 'd1')).toEqual(hostPosition(start, 'd1'))
  expect(askPlan(merged, 'get-plan').walls[0]!.devices[0]).toMatchObject({ id: 'd1', at: 4500 })
  expect(parseDocument(merged)).toEqual(merged)
})

test('circuit route anchors survive splitting, movement and simplification', () => {
  const source = standalone()
  const doc: HouseDocument = {
    ...source,
    circuits: {
      c1: {
        id: 'c1',
        panel: 'd1',
        breaker: 'B16',
        devices: [],
        route: [{ kind: 'wall', wall: 'w1', t: 0.75, z: 2400, side: 'a' }],
      },
    },
  }
  const split = runScript(doc, `add-wall --from '{"x":3000,"y":0}' --to '{"x":3000,"y":4000}'`)
  expect(hostPosition(split, 'c1 route 1')).toEqual({ x: 4500, y: 0, z: 2400 })
  const moved = runScript(split, 'update-wall --id w1 --by 500')
  expect(hostPosition(moved, 'c1 route 1')).toEqual({ x: 4500, y: 500, z: 2400 })
  expect(parseDocument(moved)).toEqual(moved)
})

test('devices in stretching neighbours retain distance from the fixed end', () => {
  let doc = runScript(standalone(), `add-wall --from '{"x":3000,"y":0}' --to '{"x":3000,"y":4000}'`)
  const partition = askPlan(doc, 'get-plan').walls.find((w) => w.id !== 'w1')!
  doc = runScript(doc, `add-device --kind switch --wall ${partition.id} --along 1000 --height 1200`)
  const next = runScript(doc, 'update-wall --id w1 --by 500')
  expect(hostPosition(next, 'd2').x).toBe(3000)
  expect(hostPosition(next, 'd2').y).toBeCloseTo(1000, 6)
  expect(hostPosition(next, 'd2').z).toBe(1200)
  expect(() => runScript(doc, 'update-wall --id w1 --by 3500')).toThrow(/host d2/)
})

test('device update and removal work through public commands', () => {
  let doc = runScript(standalone(), 'update-device --id d1 --along 3500 --height 1000 --side b')
  expect(hostPosition(doc, 'd1')).toEqual({ x: 3500, y: 0, z: 1000 })
  expect(() => runScript(doc, 'update-wall --id w1 --height 500')).toThrow(/host d1/)
  expect(() => runScript(doc, 'remove-wall --id w1')).toThrow(/electrical hosts/)
  doc = runScript(doc, 'remove-device --id d1\nremove-wall --id w1')
  expect(doc.devices).toEqual({})
  expect(doc.walls).toEqual({})
})

test('opening edits cannot remove the support beneath a wall-mounted device', () => {
  let doc = runScript(
    room(),
    `add-device --kind socket --wall ${north(room()).id} --along 1500 --height 1000`,
  )
  expect(() =>
    runScript(doc, 'add-opening --room Room --side north --kind window --along 6500 --width 1200'),
  ).toThrow(/inside an opening/)
  doc = runScript(
    doc,
    'add-opening --room Room --side north --kind window --along 4000 --width 1200',
  )
  expect(() =>
    runScript(doc, `update-opening --id o1 --to-wall ${north(doc).id} --along 1500`),
  ).toThrow(/inside an opening/)
})
