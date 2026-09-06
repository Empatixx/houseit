import { expect, test } from 'vitest'
import { findFaces } from './faces'
import { areasOf, planWith } from './test-utils'

test('four walls closing a rectangle make one room of the enclosed area', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])

  const faces = findFaces(doc, level)

  expect(faces).toHaveLength(1)
  expect(faces[0]?.area).toBe(4000 * 3000)
})

test('a wall shared by two rooms yields both rooms, not one merged room', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 6000, 0],
    [6000, 0, 6000, 3000],
    [6000, 3000, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
    [4000, 0, 4000, 3000],
  ])

  expect(areasOf(findFaces(doc, level))).toEqual([2000 * 3000, 4000 * 3000])
})

test('a partition that shares no node with the walls it crosses divides nothing', () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 3000],
    [6000, 3000, 0, 3000],
    [0, 3000, 0, 0],
    [4000, 0, 4000, 3000],
  ])

  expect(areasOf(findFaces(doc, level))).toEqual([6000 * 3000])
})

test('a wall stub poking into a room does not create a second room', () => {
  const { doc, level } = planWith([
    [0, 0, 2000, 0],
    [2000, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
    [2000, 0, 2000, 1000],
  ])

  const faces = findFaces(doc, level)

  expect(faces).toHaveLength(1)
  expect(faces[0]?.area).toBe(4000 * 3000)
})

test('walls that do not close enclose nothing', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
  ])

  expect(findFaces(doc, level)).toEqual([])
})

test('an L-shaped room is one room of its true area', () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 2000],
    [6000, 2000, 3000, 2000],
    [3000, 2000, 3000, 5000],
    [3000, 5000, 0, 5000],
    [0, 5000, 0, 0],
  ])

  const faces = findFaces(doc, level)

  expect(faces).toHaveLength(1)
  expect(faces[0]?.area).toBe(6000 * 2000 + 3000 * 3000)
})

test('walls on another level are not part of this level rooms', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  doc.walls.w1!.level = 'some-other-level'

  expect(findFaces(doc, level)).toEqual([])
})
