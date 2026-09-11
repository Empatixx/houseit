import { expect, test } from 'vitest'
import { closes } from './closes'
import { createEmptyDocument, type HouseDocument } from './document'
import { loopsFor } from './loops'

function rectangle(): { doc: HouseDocument; level: string } {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  const corners: [string, number, number][] = [
    ['n1', 0, 0],
    ['n2', 4000, 0],
    ['n3', 4000, 3000],
    ['n4', 0, 3000],
  ]
  for (const [id, x, y] of corners) doc.nodes[id] = { id, x, y }
  const edges: [string, string, string][] = [
    ['w1', 'n1', 'n2'],
    ['w2', 'n2', 'n3'],
    ['w3', 'n3', 'n4'],
    ['w4', 'n4', 'n1'],
  ]
  for (const [id, a, b] of edges) {
    doc.walls[id] = { id, level, a, b, thickness: 150, baseOffset: 0, height: 2600 }
  }
  doc.rooms.r1 = { id: 'r1', level, x: 2000, y: 1500, name: 'pokoj', loop: [] }
  return { doc, level }
}

test('the loop of a room is every wall around it', () => {
  const { doc, level } = rectangle()

  const loops = loopsFor(doc, level)

  expect([...(loops.get('r1') ?? [])].sort()).toEqual(['w1', 'w2', 'w3', 'w4'])
})

test('a room whose label falls outside every face gets no loop', () => {
  const { doc, level } = rectangle()
  doc.rooms.r1!.x = 9000

  expect(loopsFor(doc, level).get('r1')).toBeUndefined()
})

test('a loop closes when each wall shares a node with the next', () => {
  const { doc } = rectangle()

  expect(closes(doc.walls, ['w1', 'w2', 'w3', 'w4'])).toBe(true)
})

test('a loop with a wall missing does not close', () => {
  const { doc } = rectangle()

  expect(closes(doc.walls, ['w1', 'w2', 'w4'])).toBe(false)
})

test('a loop naming a wall that is not there does not close', () => {
  const { doc } = rectangle()

  expect(closes(doc.walls, ['w1', 'w2', 'w3', 'gone'])).toBe(false)
})

test('a single wall is no loop, because a room needs an inside', () => {
  const { doc } = rectangle()

  expect(closes(doc.walls, ['w1'])).toBe(false)
  expect(closes(doc.walls, [])).toBe(false)
})
