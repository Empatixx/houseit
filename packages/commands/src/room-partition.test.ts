import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import { clashes, wallBox } from '@houseit/geometry/boxes'
import { roomLabel } from '@houseit/geometry/room-label'
import { roomsOf } from '@houseit/geometry/rooms'
import { walkClear } from '@houseit/geometry/walking'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const source = readFileSync(
  new URL('../../../fixtures/building-proof/free-partitions.txt', import.meta.url),
  'utf8',
)

test('free partitions consume floor, leave one room and two passable ends, and read back through CLI', () => {
  const before = runScript(createEmptyDocument(), source.split('update-room')[0]!)
  const doc = runScript(
    before,
    source
      .split('\n')
      .filter((line) => line.startsWith('update-room'))
      .join('\n'),
  )
  const level = Object.keys(doc.levels)[0]!
  const rooms = roomsOf(doc, level)
  expect(rooms).toHaveLength(2)
  for (const room of rooms) {
    expect(room.partitions).toHaveLength(1)
    expect(roomsOf(before, level).find((r) => r.id === room.id)!.clear - room.clear).toBeCloseTo(
      3300 * 125,
      6,
    )
    const wall = doc.walls[room.partitions[0]!]!,
      a = doc.nodes[wall.a]!
    expect(walkClear(doc, level, { x: a.x, y: 3000 })).toBe(false)
    expect(walkClear(doc, level, { x: a.x, y: 800 })).toBe(true)
    expect(walkClear(doc, level, { x: a.x, y: 5200 })).toBe(true)
    const label = roomLabel(doc, level, room)
    expect(
      clashes(
        {
          x0: label.x - label.width / 2,
          x1: label.x + label.width / 2,
          y0: label.y - label.height / 2,
          y1: label.y + label.height / 2,
        },
        wallBox(a, doc.nodes[wall.b]!, wall.thickness),
        0,
      ),
    ).toBe(false)
  }
  const read = askPlan(doc, 'get-plan --room Salon')
  expect(read.unassigned).toBeUndefined()
  expect(read.rooms[0]!.partitions).toEqual([
    {
      id: rooms[0]!.partitions[0],
      from: { x: 3300, y: 1350 },
      to: { x: 3300, y: 4650 },
      thickness: 125,
      height: 3300,
    },
  ])
})

test('a detached partition refuses a boundary, an existing wall, and a door swing', () => {
  const doc = runScript(createEmptyDocument(), source)
  const line = (x: number, a: number, b: number) =>
    `update-room --room Salon --partition '{"points":[{"x":${x},"y":${a}},{"x":${x},"y":${b}}],"thickness":125,"height":3300}'`
  expect(() => runScript(doc, line(3300, 0, 1000))).toThrow('both ends free')
  expect(() => runScript(doc, line(3300, 2000, 4000))).toThrow('meets wall')
  expect(() => runScript(doc, line(6500, 600, 1600))).toThrow('blocks door')
})
