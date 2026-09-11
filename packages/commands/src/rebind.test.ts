import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import { expect, test } from 'vitest'
import { rebind } from './rebind'

function rectangle(): { doc: Draft<HouseDocument>; level: string } {
  const doc = createEmptyDocument() as Draft<HouseDocument>
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

test('a room drawn but never bound is taken in by where its label stands', () => {
  const { doc, level } = rectangle()

  rebind(doc, level)

  expect([...doc.rooms.r1!.loop].sort()).toEqual(['w1', 'w2', 'w3', 'w4'])
})

test('a room keeps its name when its walls only move', () => {
  const { doc, level } = rectangle()
  rebind(doc, level)
  const was = doc.rooms.r1!.loop

  doc.nodes.n3!.y = 5000
  doc.nodes.n4!.y = 5000
  rebind(doc, level)

  expect(doc.rooms.r1!.loop).toEqual(was)
  expect(doc.rooms.r1!.name).toBe('pokoj')
})

test('a room keeps its name when a wall is added to its boundary', () => {
  const { doc, level } = rectangle()
  rebind(doc, level)

  doc.nodes.n5 = { id: 'n5', x: 4000, y: 1500 }
  doc.walls.w2!.b = 'n5'
  doc.walls.w5 = { id: 'w5', level, a: 'n5', b: 'n3', thickness: 150, baseOffset: 0, height: 2600 }
  rebind(doc, level)

  expect([...doc.rooms.r1!.loop].sort()).toEqual(['w1', 'w2', 'w3', 'w4', 'w5'])
  expect(doc.rooms.r1!.name).toBe('pokoj')
})

test('the label comes back when its room has moved out from under it', () => {
  const { doc, level } = rectangle()
  rebind(doc, level)

  for (const node of Object.values(doc.nodes)) node.x += 20000
  rebind(doc, level)

  expect(doc.rooms.r1!.x).toBeGreaterThan(20000)
  expect(doc.rooms.r1!.x).toBeLessThan(24000)
})

test('a room whose face is gone loses its loop but keeps its record', () => {
  const { doc, level } = rectangle()
  rebind(doc, level)

  delete doc.walls.w3

  rebind(doc, level)

  expect(doc.rooms.r1!.loop).toEqual([])
  expect(doc.rooms.r1!.name).toBe('pokoj')
})

test('two rooms each keep their own half when a wall is drawn between them', () => {
  const { doc, level } = rectangle()
  rebind(doc, level)

  doc.nodes.n5 = { id: 'n5', x: 2000, y: 0 }
  doc.nodes.n6 = { id: 'n6', x: 2000, y: 3000 }
  doc.walls.w1!.b = 'n5'
  doc.walls.w5 = { id: 'w5', level, a: 'n5', b: 'n2', thickness: 150, baseOffset: 0, height: 2600 }
  doc.walls.w3!.b = 'n6'
  doc.walls.w6 = { id: 'w6', level, a: 'n6', b: 'n4', thickness: 150, baseOffset: 0, height: 2600 }
  doc.walls.w7 = { id: 'w7', level, a: 'n5', b: 'n6', thickness: 150, baseOffset: 0, height: 2600 }
  doc.rooms.r1!.x = 1000
  doc.rooms.r2 = { id: 'r2', level, x: 3000, y: 1500, name: 'kuchyň', loop: [] }
  rebind(doc, level)

  expect(doc.rooms.r1!.loop).not.toEqual([])
  expect(doc.rooms.r2!.loop).not.toEqual([])
  expect(doc.rooms.r1!.loop).not.toEqual(doc.rooms.r2!.loop)
  expect(doc.rooms.r1!.x).toBeLessThan(2000)
  expect(doc.rooms.r2!.x).toBeGreaterThan(2000)
})
