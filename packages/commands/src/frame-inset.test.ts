import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import { openingRecesses } from '@houseit/geometry/opening-recesses'
import { walkClear, walkSurface } from '@houseit/geometry/walking'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const source = readFileSync(
  new URL('../../../fixtures/building-proof/frame-inset.txt', import.meta.url),
  'utf8',
)
const frame = (inset?: number) =>
  JSON.stringify({ depth: 74, face: 60, inset, outside: '#383e42', inside: '#ffffff' })

test('explicit frame depth determines the clear floor recess and the glazing collision plane', () => {
  const doc = runScript(createEmptyDocument(), source)
  const rooms = askPlan(doc, 'get-plan').rooms
  expect(rooms.map((r) => r.areaM2)).toEqual([22.11, 21.66, 21.09])
  expect(rooms[0]!.recesses![0]!.areaM2).toBeCloseTo(1.017)
  expect(rooms[2]!.recesses).toBeUndefined()
  const level = doc.walls[doc.openings.o1!.wall]!.level
  expect(walkClear(doc, level, { x: 1500, y: 3890 })).toBe(true)
  expect(walkClear(doc, level, { x: 1500, y: 3900 })).toBe(false)
  expect(walkClear(doc, level, { x: 7500, y: 3790 })).toBe(true)
  expect(walkClear(doc, level, { x: 7500, y: 3800 })).toBe(false)
  for (const y of [3700, 4000, 4150, 4400]) expect(walkClear(doc, level, { x: 3250, y })).toBe(true)
  expect(walkClear(doc, level, { x: 2850, y: 4100 })).toBe(false)
  const updated = runScript(doc, `update-opening --id o1 --frame '${frame(226)}'`)
  expect(askPlan(updated, 'get-plan --room Outer').rooms[0]!.areaM2).toBe(21.09)
  const legacy = runScript(doc, `update-opening --id o1 --frame '${frame()}'`)
  expect(askPlan(legacy, 'get-plan --room Outer').rooms[0]!.areaM2).toBe(21.09)
  expect(openingRecesses(legacy, level).map((r) => r.opening)).toEqual(['o2'])
})

test('the floor continues to the outer frame face on an upper storey', () => {
  const doc = runScript(
    createEmptyDocument(),
    `update-level --height 3000\nadd-level --name Raised --height 3300\n${source
      .split('\n')
      .slice(1)
      .filter(Boolean)
      .map((line) => `${line} --level Raised`)
      .join('\n')}`,
  )
  const level = doc.walls[doc.openings.o1!.wall]!.level
  expect(doc.levels[level]!.elevation).toBe(3000)
  expect(walkSurface(doc, { x: 3250, y: 4120 }, 3000)).toEqual({ height: 3000, level })
  expect(walkSurface(doc, { x: 3250, y: 4170 }, 3000)).toBeUndefined()
})

test('an explicit frame must fit the structural depth of an exterior wall', () => {
  const doc = runScript(createEmptyDocument(), source)
  expect(() => runScript(doc, `update-opening --id o1 --frame '${frame(227)}'`)).toThrow(
    'does not fit inside the structural wall depth',
  )
  expect(() =>
    runScript(doc, `add-opening --room Outer --side east --kind door --frame '${frame(0)}'`),
  ).toThrow('needs an exterior wall')
})
