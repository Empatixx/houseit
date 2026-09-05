import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { expect, test } from 'vitest'
import { containsPoint, roomsOf } from './rooms'
import { stairwaysOn, wellsIn } from './wells'

/**
 * The document is built by hand here rather than through the commands, because
 * `geometry` is under `commands` and cannot reach for them. What it says is the
 * same either way: two storeys, and a straight flight on the lower one.
 */
function house(): { doc: HouseDocument; ground: string; upper: string } {
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
  return { doc, ground, upper }
}

/** A straight flight standing against the east wall of the lower room. */
function withStairs(doc: HouseDocument, ground: string): HouseDocument {
  doc.objects.f1 = {
    id: 'f1',
    level: ground,
    room: `r-${ground}`,
    type: 'stairs-straight',
    against: 'east',
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

  // Every corner of the well has to fall inside the room, or the floor cannot
  // be built with it as a hole — which is how the well came to be drawn nowhere.
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
