import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askScript, runScript } from './run'

const HOUSE = [
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name house',
  'add-room --material tile-white --name kitchen --from house --side west --width 4m',
  'add-door --room kitchen --side east',
  'add-window --room kitchen --side north --width 1.2m',
  'add-object --room kitchen --type sofa-3 --against south',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)

// biome-ignore lint/suspicious/noExplicitAny: a measurement is read like JSON here
const ask = (source: string, doc = house()): any => askScript(doc, source)[0]

test('the plan is measured over the outside of its walls, and every room with it', () => {
  const plan = ask('measure')

  expect(plan.width).toBeGreaterThan(12_000)
  expect(plan.rooms).toHaveLength(2)
})

test('a room is measured wall by wall, between the faces', () => {
  const kitchen = ask('measure --room kitchen')

  expect(kitchen.walls).toHaveLength(4)
  const north = kitchen.walls.find((wall: { side: string }) => wall.side === 'north')
  expect(north.length).toBe(kitchen.width)
})

test('one side of a room says what is on it and what is still free', () => {
  const south = ask('measure --room kitchen --side south')

  expect(south.objects).toEqual([
    { id: 'f1', type: 'sofa-3', from: expect.any(Number), to: expect.any(Number) },
  ])
  const sofa = south.objects[0]
  expect(sofa.to - sofa.from).toBeGreaterThan(1500)
  // A sofa in the middle leaves a stretch free either side of it.
  expect(south.free).toHaveLength(2)
  expect(south.free[0].from).toBe(0)
  expect(south.free[1].to).toBe(south.length)
})

test('an opening on a side is a stretch of it too', () => {
  const north = ask('measure --room kitchen --side north')

  expect(north.openings).toEqual([
    {
      id: expect.stringMatching(/^o\d+$/),
      kind: 'window',
      from: expect.any(Number),
      to: expect.any(Number),
    },
  ])
  expect(north.openings[0].to - north.openings[0].from).toBe(1200)
})

test('a thing is measured to the walls round it', () => {
  const sofa = ask('measure --room kitchen --type sofa-3')

  expect(sofa.object.type).toBe('sofa-3')
  // Backed onto the south wall: nothing between it and the wall; a room to the north.
  expect(sofa.clearances.south).toBeUndefined()
  expect(sofa.clearances.north).toBeGreaterThan(5000)
  expect(sofa.clearances.west).toBeGreaterThan(0)
})

test('what is not there cannot be measured, and says so by name', () => {
  expect(() => askScript(house(), 'measure --room kitchen --type queen-bed')).toThrow(
    /no .*bed in kitchen/,
  )
  expect(() => askScript(house(), 'measure --side north')).toThrow(/--room/)
  expect(() => askScript(house(), 'measure --room house --side north --type sofa-3')).toThrow(
    /no 3-seat sofa|no sofa/,
  )
})
