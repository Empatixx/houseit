import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askScript, runScript } from './run'
import type { LevelReport, RoomReport } from './survey'

/**
 * A house with two rooms, a door between them and a window and a sofa in one,
 * all through the commands — because what `describe` says has to be what the
 * commands did, in the words the commands take.
 */
const HOUSE = [
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name house',
  'add-room --material tile-white --name kitchen --from house --side west --width 4m',
  'add-door --room kitchen --side east',
  'add-window --room kitchen --side north --width 1.2m',
  'add-object --room kitchen --type sofa-3 --against south',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)

const ask = <T>(source: string, doc = house()): T => askScript(doc, source)[0] as T

test('describe answers with every room, and says nothing to a script that only edits', () => {
  expect(askScript(createEmptyDocument(), HOUSE)).toEqual([])

  const plan = ask<LevelReport>('describe')

  expect(plan.rooms.map((room) => room.name).sort()).toEqual(['house', 'kitchen'])
  // The outside of the house: 12 by 9 between wall centre lines, plus a wall.
  expect(plan.width).toBeGreaterThan(12_000)
  expect(plan.depth).toBeGreaterThan(9000)
})

test('a room is described as somebody would say it: clear size, floor, what is next door', () => {
  const kitchen = ask<RoomReport>('describe --room kitchen')

  expect(kitchen.floor).toBe('tile-white')
  expect(kitchen.neighbours).toEqual(['house'])
  // Four metres between centre lines, less half a wall at each end.
  expect(kitchen.width).toBeLessThan(4000)
  expect(kitchen.width).toBeGreaterThan(3600)
  expect(kitchen.areaM2).toBeCloseTo(36, 0)
  expect(kitchen.walls.map((wall) => wall.side).sort()).toEqual(['east', 'north', 'south', 'west'])
})

test('doors and windows are told by side, and a door says which room it opens from', () => {
  const kitchen = ask<RoomReport>('describe --room kitchen')

  expect(kitchen.doors).toEqual([
    { side: 'east', along: 0.5, width: 800, variant: 'hinged', to: 'house' },
  ])
  // The window was centred on the wall's centre line; the side's run is trimmed
  // by a thick outer wall at one end and a thin partition at the other, so the
  // window sits a hair off the run's middle — and that is what is said.
  expect(kitchen.windows).toHaveLength(1)
  expect(kitchen.windows[0]).toMatchObject({ side: 'north', width: 1200 })
  expect(kitchen.windows[0]!.along).toBeCloseTo(0.5, 1)
})

test('the same door seen from the other room is in the opposite wall and leads back', () => {
  const house = ask<RoomReport>('describe --room house')

  expect(house.doors).toHaveLength(1)
  expect(house.doors[0]).toMatchObject({ side: 'west', to: 'kitchen' })
})

test('a door to the outside says so', () => {
  const doc = runScript(house(), 'add-door --room house --side south')

  const outside = ask<RoomReport>('describe --room house', doc).doors.find(
    (d) => d.side === 'south',
  )

  expect(outside?.to).toBe('outside')
})

test('what stands in a room is told the way it was put there, with where that came to', () => {
  const kitchen = ask<RoomReport>('describe --room kitchen')

  expect(kitchen.objects).toHaveLength(1)
  const sofa = kitchen.objects[0]!
  expect(sofa).toMatchObject({ type: 'sofa-3', against: 'south', along: 0.5 })
  expect(sofa.at).toBeDefined()
  // Against the south wall, so it stands low in the room.
  expect(sofa.at!.y).toBeLessThan(kitchen.box.y0 + 1500)
})

test('a describe at the end of a script sees what the script did', () => {
  const [plan] = askScript(createEmptyDocument(), `${HOUSE}\ndescribe`) as LevelReport[]

  expect(plan?.rooms).toHaveLength(2)
})

test('an unknown room is refused by name', () => {
  expect(() => askScript(house(), 'describe --room attic')).toThrow(/no room called attic/)
})

test('what is said is plain data that survives leaving the transaction', () => {
  const plan = ask<LevelReport>('describe')

  expect(() => JSON.stringify(plan)).not.toThrow()
  expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
})
