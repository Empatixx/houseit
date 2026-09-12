import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const floor = () =>
  runScript(
    createEmptyDocument(),
    'add-room --name Room --shape rectangle --width 4m --depth 4m --material ceramic-tile',
  )
const hingePoint = (doc: HouseDocument) => {
  const o = Object.values(doc.openings)[0]!
  const w = doc.walls[o.wall]!,
    a = doc.nodes[w.a]!,
    b = doc.nodes[w.b]!
  const t = o.t + ((o.hinge === 'a' ? -1 : 1) * o.width) / 2 / Math.hypot(b.x - a.x, b.y - a.y)
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

test('left hinges are read from the room, independent of wall direction', () => {
  for (const [side, point] of [
    ['north', { x: 1600, y: 4000 }],
    ['south', { x: 2400, y: 0 }],
    ['east', { x: 4000, y: 2400 }],
    ['west', { x: 0, y: 1600 }],
  ] as const) {
    const doc = runScript(
      floor(),
      `add-opening --room Room --kind door --side ${side} --width 800 --hinge left`,
    )
    expect(hingePoint(doc)).toEqual(point)
    expect(askPlan(doc, 'get-plan --room Room').rooms[0]!.openings[0]).toMatchObject({
      hinge: 'left',
      opensInto: 'Room',
    })
  }
})

test('moving preserves handedness, and changing the hinge keeps the opening in place', () => {
  const north = runScript(
    floor(),
    'add-opening --room Room --kind door --side north --width 800 --hinge left',
  )
  const id = Object.keys(north.openings)[0]!
  const south = runScript(north, `update-opening --id ${id} --to-side south`)
  expect(hingePoint(south)).toEqual({ x: 2400, y: 0 })
  const right = runScript(south, `update-opening --id ${id} --hinge right`)
  expect(hingePoint(right)).toEqual({ x: 1600, y: 0 })
  expect(right.openings[id]).toMatchObject({
    wall: south.openings[id]!.wall,
    t: south.openings[id]!.t,
    width: 800,
  })
  expect(() => runScript(right, `update-opening --id ${id} --variant pocket --hinge left`)).toThrow(
    '--hinge needs a hinged door',
  )
  expect(() =>
    runScript(floor(), 'add-opening --room Room --kind window --side north --hinge left'),
  ).toThrow('--hinge needs a hinged door')
})
