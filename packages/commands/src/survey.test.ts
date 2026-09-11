import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'
import type { OpeningReport, RoomReport } from './survey'

const HOUSE = [
  'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
  'add-room --material tile-white --name kitchen --from house --side west --width 4m',
  'add-opening --kind door --room kitchen --side east',
  'add-opening --kind window --room kitchen --side north --width 1.2m',
  'add-object --room kitchen --type sofa-3 --against south',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const room = (name: string, doc = house()): RoomReport =>
  askPlan(doc, `get-plan --room ${name}`).rooms[0]!
const doorsOf = (report: RoomReport): OpeningReport[] =>
  report.openings.filter((it) => it.kind === 'door')
const windowsOf = (report: RoomReport): OpeningReport[] =>
  report.openings.filter((it) => it.kind === 'window')
const side = (report: RoomReport, which: string) => report.sides.find((it) => it.side === which)!

test('every command answers about what it touched, and get-plan about the rest', () => {
  const built = askPlan(createEmptyDocument(), HOUSE)

  expect(built.rooms.map((it) => it.name).sort()).toEqual(['house', 'kitchen'])
  expect(built.width).toBeGreaterThan(12_000)
  expect(built.depth).toBeGreaterThan(9000)
  expect(askPlan(house(), 'get-plan').rooms).toHaveLength(2)
})

test('a room is said as somebody would say it: clear size, floor, what is next door', () => {
  const kitchen = room('kitchen')

  expect(kitchen.floor).toBe('tile-white')
  expect(kitchen.neighbours).toEqual(['house'])
  expect(kitchen.width).toBeLessThan(4000)
  expect(kitchen.width).toBeGreaterThan(3600)
  expect(kitchen.areaM2).toBeCloseTo(32.8, 0)
  expect(kitchen.walls.map((wall) => wall.side).sort()).toEqual(['east', 'north', 'south', 'west'])
})

test('doors and windows are one list, told apart by kind, and a door says where it leads', () => {
  const kitchen = room('kitchen')

  expect(doorsOf(kitchen)).toEqual([
    expect.objectContaining({
      side: 'east',
      along: 0.5,
      width: 800,
      variant: 'hinged',
      to: 'house',
    }),
  ])
  expect(doorsOf(kitchen)[0]!.id).toMatch(/^o\d+$/)
  expect(doorsOf(kitchen)[0]!.wall).toMatch(/^w\d+$/)
  expect(windowsOf(kitchen)).toHaveLength(1)
  expect(windowsOf(kitchen)[0]).toMatchObject({ side: 'north', width: 1200, sill: 900 })
  expect(windowsOf(kitchen)[0]!.along).toBeCloseTo(0.5, 1)
  expect(windowsOf(kitchen)[0]!.variant).toBeUndefined()
  expect(doorsOf(kitchen)[0]!.sill).toBeUndefined()
})

test('the same door seen from the other room is in the opposite wall and leads back', () => {
  expect(doorsOf(room('house'))).toHaveLength(1)
  expect(doorsOf(room('house'))[0]).toMatchObject({ side: 'west', to: 'kitchen' })
})

test('a door to the outside says so', () => {
  const doc = runScript(house(), 'add-opening --kind door --room house --side south')

  const outside = doorsOf(room('house', doc)).find((it) => it.side === 'south')

  expect(outside?.to).toBe('outside')
})

test('what stands in a room is told the way it was put there, with where that came to', () => {
  const kitchen = room('kitchen')

  expect(kitchen.objects).toHaveLength(1)
  const sofa = kitchen.objects[0]!
  expect(sofa).toMatchObject({ type: 'sofa-3', against: 'south', along: 0.5 })
  expect(sofa.at).toBeDefined()
  expect(sofa.at!.y).toBeLessThan(kitchen.box.y0 + 1500)
  expect(sofa.clear!.south).toBeUndefined()
  expect(sofa.clear!.north).toBeGreaterThan(5000)
})

test('each side of a room says what is on it and what is still free', () => {
  const kitchen = room('kitchen')
  const south = side(kitchen, 'south')

  expect(south.objects).toEqual([
    {
      id: kitchen.objects[0]!.id,
      type: 'sofa-3',
      from: expect.any(Number),
      to: expect.any(Number),
    },
  ])
  expect(south.objects[0]!.to - south.objects[0]!.from).toBeGreaterThan(1500)
  expect(south.free).toHaveLength(2)
  expect(south.free[0]!.from).toBe(0)
  expect(south.free[1]!.to).toBe(south.length)
})

test('an opening on a side is a stretch of it too, and takes its width out of the free', () => {
  const north = side(room('kitchen'), 'north')

  expect(north.openings).toEqual([
    {
      id: expect.stringMatching(/^o\d+$/),
      kind: 'window',
      from: expect.any(Number),
      to: expect.any(Number),
    },
  ])
  expect(north.openings[0]!.to - north.openings[0]!.from).toBe(1200)
  expect(north.free).toHaveLength(2)
})

test('a side names the walls it is made of, each with its own stretch of the run', () => {
  const north = side(room('kitchen'), 'north')

  expect(north.walls).toHaveLength(1)
  expect(north.walls[0]!.id).toMatch(/^w\d+$/)
  expect(north.walls[0]!.to - north.walls[0]!.from).toBe(north.length)
})

test('an unknown room is refused by name', () => {
  expect(() => askPlan(house(), 'get-plan --room attic')).toThrow(/no room called attic/)
})

test('what is said is plain data that survives leaving the transaction', () => {
  const plan = askPlan(house(), 'get-plan')

  expect(() => JSON.stringify(plan)).not.toThrow()
  expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
})

test('a room nothing has been done to is not in the answer, and get-plan is how to see it', () => {
  const doc: HouseDocument = house()
  const answer = askPlan(doc, 'add-object --room kitchen --type stove --against north')

  expect(answer.rooms.map((it) => it.name)).toEqual(['kitchen'])
  expect(askPlan(doc, 'get-plan').rooms).toHaveLength(2)
})
