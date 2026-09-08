import { createEmptyDocument } from '@houseit/core/document'
import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { worldOf } from './world'

test('an empty plan is a house with one bare storey in it', () => {
  const world = worldOf(createEmptyDocument())

  expect(world.storeys).toHaveLength(1)
  expect(world.storeys[0]?.pieces).toEqual([])
})

test('a storey stands at the height it really stands at, not at nought', () => {
  const { doc } = planWith([[0, 0, 4000, 0]])
  const ground = Object.values(doc.levels)[0]!
  doc.levels.up = { id: 'up', name: '1. patro', elevation: 3000, height: 2600 }

  const world = worldOf(doc)
  expect(world.storeys.map((storey) => storey.elevation)).toEqual([ground.elevation, 3000])
})

test('a storey carries its walls, its floors, its lid and what stands on it', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  doc.rooms.r1 = { id: 'r1', level, x: 2000, y: 1500, name: 'room' }

  const built = worldOf(doc).storeys[0]!.pieces
  expect(built.filter((piece) => piece.of?.kind === 'wall').length).toBe(4)
  expect(built.filter((piece) => piece.body.kind === 'sheet').length).toBe(1)
  expect(built.filter((piece) => piece.body.kind === 'prism').length).toBe(1)
})

test('every piece has a name of its own, so what is drawn can be told apart', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  doc.rooms.r1 = { id: 'r1', level, x: 2000, y: 1500, name: 'room' }

  const names = worldOf(doc).storeys[0]!.pieces.map((piece) => piece.name)
  expect(names.every(Boolean)).toBe(true)
  expect(new Set(names).size).toBe(names.length)
})
