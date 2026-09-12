import { createEmptyDocument, type HouseDocument, parseDocument } from '@houseit/core/document'
import { wallElement } from '@houseit/geometry/wall-elements'
import { applyPatches } from 'immer'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScriptWithPatches } from './patches'
import { runScript } from './run'

const add = (x1: number, y1: number, x2: number, y2: number) =>
  `add-wall --from '{"x":${x1},"y":${y1}}' --to '{"x":${x2},"y":${y2}}'`
const openingAt = (doc: HouseDocument, id: string) => {
  const o = doc.openings[id]!,
    w = doc.walls[o.wall]!,
    a = doc.nodes[w.a]!,
    b = doc.nodes[w.b]!
  return { x: a.x + (b.x - a.x) * o.t, y: a.y + (b.y - a.y) * o.t }
}
const skew = () =>
  runScript(createEmptyDocument(), `${add(0, 0, 6000, 0)}\n${add(3000, 0, 5000, 4000)}`)

test('moving a parent wall slides its skew junction along the branch without rotating it', () => {
  let doc = skew()
  const branch = askPlan(doc, 'get-plan').walls.find((w) => w.id !== 'w1')!
  doc = runScript(
    doc,
    `add-opening --wall w1 --kind window --along 4500 --width 1000\nadd-opening --wall ${branch.id} --kind door --along 2000 --width 800`,
  )
  const fixed = openingAt(doc, 'o2')
  const next = runScript(doc, 'update-wall --id w1 --by 500')
  expect(wallElement(next, branch.id).from).toMatchObject({ x: 3250, y: 500 })
  expect(wallElement(next, branch.id).to).toMatchObject({ x: 5000, y: 4000 })
  expect(openingAt(next, 'o1')).toEqual({ x: 4500, y: 500 })
  expect(openingAt(next, 'o2').x).toBeCloseTo(fixed.x, 6)
  expect(openingAt(next, 'o2').y).toBeCloseTo(fixed.y, 6)
})

test('moving a skew branch slides its root on the parent and preserves the parent opening', () => {
  let doc = skew()
  const branch = askPlan(doc, 'get-plan').walls.find((w) => w.id !== 'w1')!
  doc = runScript(doc, 'add-opening --wall w1 --kind window --along 4500 --width 1000')
  const next = runScript(doc, `update-wall --id ${branch.id} --by 500`)
  expect(wallElement(next, branch.id).from).toMatchObject({ x: 2441, y: 0 })
  expect(wallElement(next, 'w1').from).toMatchObject({ x: 0, y: 0 })
  expect(wallElement(next, 'w1').to).toMatchObject({ x: 6000, y: 0 })
  expect(openingAt(next, 'o1')).toEqual({ x: 4500, y: 0 })
})

test('a new X junction splits both walls while preserving authoring identities and undo', () => {
  const doc = runScript(
    createEmptyDocument(),
    `${add(0, 0, 6000, 0)}\n${add(3000, 500, 3000, 4000)}`,
  )
  const result = runScriptWithPatches(doc, 'update-wall --id w1 --by 1000')
  const next = result.doc
  expect(askPlan(next, 'get-plan').walls).toHaveLength(2)
  expect(Object.values(next.walls)).toHaveLength(4)
  const junction = Object.values(next.nodes).find((n) => n.x === 3000 && n.y === 1000)!
  expect(
    Object.values(next.walls).filter((w) => w.a === junction.id || w.b === junction.id),
  ).toHaveLength(4)
  expect(applyPatches(next, result.inversePatches)).toEqual(doc)
  expect(parseDocument(next)).toEqual(next)
})

test('endpoint contact merges nodes instead of leaving coincident disconnected ends', () => {
  const doc = runScript(
    createEmptyDocument(),
    `${add(0, 0, 6000, 0)}\n${add(6000, 1000, 6000, 4000)}`,
  )
  const next = runScript(doc, 'update-wall --id w1 --by 1000')
  expect(next.walls.w1!.b).toBe(next.walls.w2!.a)
  expect(Object.keys(next.nodes)).toHaveLength(3)
})

test('multiple rounded intersections retain the whole oblique wall direction', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      add(0, 0, 8000, 3000),
      add(1001, 700, 1001, 5000),
      add(3001, 1500, 3001, 5000),
      add(5001, 2200, 5001, 5000),
    ].join('\n'),
  )
  const next = runScript(doc, 'update-wall --id w1 --by 500')
  expect(wallElement(next, 'w1').segments).toHaveLength(4)
  expect(wallElement(next, 'w1').length).toBeCloseTo(Math.hypot(8000, 3000), 6)
  expect(parseDocument(next)).toEqual(next)
})

test('a new junction through an existing opening refuses all topology edits', () => {
  const doc = runScript(
    createEmptyDocument(),
    `${add(0, 0, 6000, 0)}\n${add(3000, 500, 3000, 4000)}\nadd-opening --wall w1 --kind window --along 3000`,
  )
  const before = JSON.stringify(doc)
  expect(() => runScript(doc, 'update-wall --id w1 --by 1000')).toThrow(/through a window/)
  expect(JSON.stringify(doc)).toBe(before)
})
