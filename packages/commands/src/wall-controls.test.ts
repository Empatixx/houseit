import { createEmptyDocument, parseDocument } from '@houseit/core/document'
import { wallElement } from '@houseit/geometry/wall-elements'
import { applyPatches } from 'immer'
import { expect, test } from 'vitest'
import { runScriptWithPatches } from './patches'
import { runScript } from './run'

const host = () =>
  runScript(
    createEmptyDocument(),
    [
      `add-wall --from '{"x":0,"y":0}' --to '{"x":5000,"y":0}'`,
      'add-opening --wall w1 --kind window --along 2000 --width 1000',
      'add-device --kind socket --wall w1 --along 4000 --height 300',
    ].join('\n'),
  )

test('length edits preserve a wall id, openings, devices and exact undo', () => {
  const doc = host()
  const result = runScriptWithPatches(doc, 'update-wall --id w1 --length 6000')
  const next = result.doc
  expect(wallElement(next, 'w1').to).toMatchObject({ x: 6000, y: 0 })
  expect(next.openings.o1!.t * 6000).toBe(2000)
  expect(next.devices.d1!.host).toMatchObject({ kind: 'wall', wall: 'w1', t: 4000 / 6000 })
  expect(applyPatches(next, result.inversePatches)).toEqual(doc)
})

test('resizing from the start keeps the opposite endpoint and hosted world positions fixed', () => {
  const next = runScript(host(), 'update-wall --id w1 --length 6000 --end from')
  expect(wallElement(next, 'w1').from).toMatchObject({ x: -1000, y: 0 })
  expect(wallElement(next, 'w1').to).toMatchObject({ x: 5000, y: 0 })
  expect(next.openings.o1!.t * 6000 - 1000).toBe(2000)
  expect(next.devices.d1!.host).toMatchObject({ t: 5000 / 6000 })
})

test('extending a free endpoint creates a junction and retains the authoring id', () => {
  const doc = runScript(host(), `add-wall --from '{"x":6000,"y":-2000}' --to '{"x":6000,"y":2000}'`)
  const next = runScript(doc, 'update-wall --id w1 --length 6000')
  const wall = wallElement(next, 'w1')
  expect(
    Object.values(next.walls).filter((w) => w.a === wall.to.id || w.b === wall.to.id),
  ).toHaveLength(3)
  expect(next.openings.o1!.wall).toBe('w1')
  expect(() => runScript(next, 'update-wall --id w1 --length 6500')).toThrow(/free endpoint/)
  expect(parseDocument(next)).toEqual(next)
})

test('shortening past a device or a topology junction refuses the entire edit', () => {
  const doc = host()
  const before = JSON.stringify(doc)
  expect(() => runScript(doc, 'update-wall --id w1 --length 3500')).toThrow(/hosted/)
  expect(JSON.stringify(doc)).toBe(before)
  const split = runScript(doc, `add-wall --from '{"x":4500,"y":0}' --to '{"x":4500,"y":2000}'`)
  expect(() => runScript(split, 'update-wall --id w1 --length 4200')).toThrow(/continuous/)
})

test('a room side containing several independent elements requires an explicit wall', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      `add-wall --from '{"x":0,"y":0}' --to '{"x":3000,"y":0}'`,
      `add-wall --from '{"x":3000,"y":0}' --to '{"x":6000,"y":0}'`,
      `add-wall --from '{"x":6000,"y":0}' --to '{"x":6000,"y":4000}'`,
      `add-wall --from '{"x":6000,"y":4000}' --to '{"x":0,"y":4000}'`,
      `add-wall --from '{"x":0,"y":4000}' --to '{"x":0,"y":0}'`,
      `add-room --at '{"x":2000,"y":2000}' --name Living --material natural-oak`,
    ].join('\n'),
  )
  expect(() => runScript(doc, 'update-room --room Living --side south --by 300')).toThrow(
    /one independent wall/,
  )
})
