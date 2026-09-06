import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { stairShape } from '@houseit/core/stairs'
import { expect, test } from 'vitest'
import { containsPoint, roomsOf } from './rooms'
import { footprintOf, standingAt } from './standing'
import { stairwaysOn, wellOf, wellsIn, wellsInRoom } from './wells'

function house(partition?: number): { doc: HouseDocument; ground: string; upper: string } {
  const doc = createEmptyDocument()
  const ground = levelsOf(doc)[0]!.id
  const upper = 'l2'
  doc.levels[upper] = { id: upper, name: 'Upstairs', elevation: 2800, height: 2800 }

  const corners = [
    { x: 0, y: 0 },
    { x: 8000, y: 0 },
    { x: 8000, y: 7000 },
    { x: 0, y: 7000 },
  ]
  for (const level of [ground, upper]) {
    const nodes = corners.map((corner, index) => {
      const id = `n-${level}-${index}`
      doc.nodes[id] = { id, ...corner }
      return id
    })
    nodes.forEach((from, index) => {
      const id = `w-${level}-${index}`
      doc.walls[id] = {
        id,
        level,
        a: from,
        b: nodes[(index + 1) % nodes.length]!,
        thickness: 300,
        baseOffset: 0,
        height: 2800,
      }
    })
    const room = `r-${level}`
    doc.rooms[room] = { id: room, level, x: 4000, y: 3500, name: level === ground ? 'down' : 'up' }
  }

  if (partition !== undefined) {
    const south = `n-${upper}-south`
    const north = `n-${upper}-north`
    doc.nodes[south] = { id: south, x: partition, y: 0 }
    doc.nodes[north] = { id: north, x: partition, y: 7000 }
    const wall = (id: string, a: string, b: string) => {
      doc.walls[id] = { id, level: upper, a, b, thickness: 150, baseOffset: 0, height: 2800 }
    }
    delete doc.walls[`w-${upper}-0`]
    delete doc.walls[`w-${upper}-2`]
    wall('w-up-s1', `n-${upper}-0`, south)
    wall('w-up-s2', south, `n-${upper}-1`)
    wall('w-up-n1', `n-${upper}-2`, north)
    wall('w-up-n2', north, `n-${upper}-3`)
    wall('w-up-mid', south, north)
    doc.rooms[`r-${upper}`] = {
      id: `r-${upper}`,
      level: upper,
      x: partition + 500,
      y: 3500,
      name: 'east',
    }
    doc.rooms.west = { id: 'west', level: upper, x: 500, y: 3500, name: 'west' }
  }
  return { doc, ground, upper }
}

function withStairs(
  doc: HouseDocument,
  ground: string,
  against: 'east' | 'west' = 'east',
): HouseDocument {
  doc.objects.f1 = {
    id: 'f1',
    level: ground,
    room: `r-${ground}`,
    type: 'stairs-straight',
    against,
    along: 0.5,
    width: 900,
    depth: 4200,
    surface: 'oak',
  }
  return doc
}

test('a staircase is a hole in the floor of the storey above it', () => {
  const { doc, ground, upper } = house()
  withStairs(doc, ground)

  expect(stairwaysOn(doc, ground)).toHaveLength(1)
  const wells = wellsIn(doc, upper)
  expect(wells).toHaveLength(1)
  expect(wells[0]!.object).toBe('f1')
  expect(wells[0]!.outline).toHaveLength(4)
})

test('the hole is inside the room above, so a floor can be cut round it', () => {
  const { doc, ground, upper } = house()
  withStairs(doc, ground)

  const room = roomsOf(doc, upper)[0]!
  const outline = room.nodes.map((id) => doc.nodes[id]!)
  const well = wellsIn(doc, upper)[0]!

  for (const corner of well.outline) {
    expect(containsPoint(outline, corner.x, corner.y), `${corner.x},${corner.y}`).toBe(true)
  }
})

test('the lowest floor stands on the ground, so nothing comes up through it', () => {
  const { doc, ground } = house()
  withStairs(doc, ground)

  expect(wellsIn(doc, ground)).toEqual([])
})

test('only a staircase makes a well; a wardrobe stands on the floor', () => {
  const { doc, ground, upper } = house()
  doc.objects.f2 = {
    id: 'f2',
    level: ground,
    room: `r-${ground}`,
    type: 'dresser',
    against: 'east',
    along: 0.5,
    width: 900,
    depth: 500,
    surface: 'oak',
  }

  expect(wellsIn(doc, upper)).toEqual([])
})

test('the well is the top of the flight, not the whole of it: the foot stands under the floor', () => {
  const { doc, ground, upper } = house()
  withStairs(doc, ground)

  const room = roomsOf(doc, ground)[0]!
  const spot = standingAt(doc, ground, room, doc.objects.f1!)!
  const flight = footprintOf(spot, doc.objects.f1!)
  const well = wellsIn(doc, upper)[0]!

  const foot = Math.min(...flight.map((corner) => corner.x))
  const hole = Math.min(...well.outline.map((corner) => corner.x))
  expect(hole - foot).toBeCloseTo(2 * 280, 0)
  expect(Math.max(...well.outline.map((corner) => corner.x))).toBeCloseTo(
    Math.max(...flight.map((corner) => corner.x)),
    0,
  )
})

test('an L is an L-shaped hole: the arm away and the top of the arm up, and not the corner between', () => {
  const well = wellOf(stairShape('l-winder', 2800))
  expect(well).toHaveLength(6)
})

test('a well that comes up under a wall is cut along it, and each room gets its part', () => {
  const { doc, ground, upper } = house(3000)
  withStairs(doc, ground, 'west')

  const rooms = roomsOf(doc, upper)
  expect(rooms).toHaveLength(2)
  for (const room of rooms) {
    const outline = room.nodes.map((id) => doc.nodes[id]!)
    const holes = wellsInRoom(doc, upper, room)
    expect(holes, room.name).toHaveLength(1)
    for (const corner of holes[0]!.outline) {
      expect(
        containsPoint(outline, corner.x, corner.y),
        `${room.name} ${corner.x},${corner.y}`,
      ).toBe(true)
    }
  }
})

test("a well wholly inside a room is that room's alone", () => {
  const { doc, ground, upper } = house(3000)
  withStairs(doc, ground, 'east')

  const [west, east] = roomsOf(doc, upper).sort((one, other) => one.centre.x - other.centre.x)
  expect(wellsInRoom(doc, upper, west!)).toHaveLength(0)
  expect(wellsInRoom(doc, upper, east!)).toHaveLength(1)
})
