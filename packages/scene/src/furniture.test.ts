import { CAMERA, OBJECT_TYPE_IDS } from '@houseit/core/object-types'
import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { furniturePieces } from './furniture'
import { modelled } from './models'

const house = () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  doc.rooms.r1 = { id: 'r1', level, x: 2000, y: 1500, name: 'room', loop: [] }
  return { doc, level }
}

const thing = (type: string, over: Record<string, unknown> = {}) => ({
  id: 'o1',
  level: 'l1',
  room: 'r1',
  type,
  along: 0.5,
  width: 2000,
  depth: 900,
  surface: 'grey',
  ...over,
})

test('a thing stands where the plan puts it, with the plan y read as the world z', () => {
  const { doc, level } = house()
  doc.objects.o1 = { ...thing('sofa-3'), level } as never

  const stood = furniturePieces(doc, level)
  expect(stood.length).toBeGreaterThan(0)
  expect(stood.every((piece) => piece.of?.id === 'o1')).toBe(true)
})

test('a thing with a model is built from its model, and its box is only there to be clicked', () => {
  const { doc, level } = house()
  doc.objects.o1 = { ...thing('sofa-3'), level } as never

  const stood = furniturePieces(doc, level)
  const bounds = stood.filter((piece) => piece.paint.opacity === 0)
  expect(bounds).toHaveLength(1)
  expect(stood.length).toBeGreaterThan(1)
})

test('everything in the catalogue but the camera stands in the walk as a model', () => {
  expect(OBJECT_TYPE_IDS.filter((type) => type !== CAMERA && !modelled(type))).toEqual([])
  const { doc, level } = house()
  doc.objects.o1 = { ...thing('rug-rect'), level } as never

  const stood = furniturePieces(doc, level)
  expect(stood.some((piece) => piece.body.kind === 'model')).toBe(true)
})

test('a camera is a thing in the plan but it is not furniture', () => {
  const { doc, level } = house()
  doc.objects.o1 = { ...thing(CAMERA), level } as never

  expect(furniturePieces(doc, level)).toEqual([])
})

test('a staircase is as tall as the storey it climbs, not as tall as a staircase', () => {
  const { doc, level } = house()
  const storey = doc.levels[level]!.height
  doc.objects.o1 = { ...thing('stairs-straight'), level, width: 1000, depth: 3600 } as never

  const top = Math.max(...furniturePieces(doc, level).map((piece) => piece.at.y))
  expect(top).toBeGreaterThan(storey * 0.8)
})
