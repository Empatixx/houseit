import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import { openingsIn } from '@houseit/core/opening-parts'
import { walkClear } from '@houseit/geometry/walking'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const source = readFileSync(
  new URL('../../../fixtures/building-proof/paired-doors.txt', import.meta.url),
  'utf8',
)

test('one paired doorway has two unequal leaves but a continuous walkable passage', () => {
  const doc = runScript(createEmptyDocument(), source)
  expect(Object.values(doc.openings)).toHaveLength(2)
  const leaves = openingsIn(doc)
  expect(leaves).toHaveLength(4)
  const first = leaves.filter((o) => o.id.startsWith('o1-'))
  expect(first.map((o) => o.width).sort()).toEqual([700, 900])
  expect(first.map((o) => o.hinge)).toEqual(['a', 'b'])
  const parent = doc.openings.o1!
  expect(first.find((o) => o.hinge === parent.hinge)!.width).toBe(900)
  const wall = doc.walls[parent.wall]!,
    a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const seam = parent.t * length - parent.width / 2 + first[0]!.width
  const at = { x: a.x + ((b.x - a.x) * seam) / length, y: a.y + ((b.y - a.y) * seam) / length }
  expect(walkClear(doc, wall.level, at)).toBe(true)
  expect(askPlan(doc, 'get-plan --room Hall').rooms[0]!.openings[0]).toMatchObject({
    width: 1600,
    leafWidth: 900,
    hinge: 'right',
  })
  const resized = runScript(doc, 'update-opening --id o1 --leaf-width 1000 --hinge left')
  const newMain = openingsIn(resized).find(
    (o) => o.id.startsWith('o1-') && o.hinge === resized.openings.o1!.hinge,
  )!
  expect(newMain.width).toBe(1000)
  const single = runScript(resized, 'update-opening --id o1 --leaf-width 0')
  expect(openingsIn(single).filter((o) => o.id.startsWith('o1'))).toHaveLength(1)
})

test('a pair cannot lose its secondary leaf or become a sliding door', () => {
  const doc = runScript(createEmptyDocument(), source)
  expect(() => runScript(doc, 'update-opening --id o1 --leaf-width 1600')).toThrow(
    'positive width for the second leaf',
  )
  expect(() => runScript(doc, 'update-opening --id o1 --variant sliding')).toThrow(
    'plain hinged door',
  )
})
