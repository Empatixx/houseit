import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { outlineOf } from './outline'

const level = 'level-1'

function withWalls(...segments: [number, number, number, number][]): HouseDocument {
  const doc = createEmptyDocument()
  const id = Object.keys(doc.levels)[0] ?? level
  segments.forEach(([x0, y0, x1, y1], index) => {
    const a = `n${index}a`
    const b = `n${index}b`
    doc.nodes[a] = { id: a, x: x0, y: y0 }
    doc.nodes[b] = { id: b, x: x1, y: y1 }
    doc.walls[`w${index}`] = {
      id: `w${index}`,
      level: id,
      a,
      b,
      thickness: 150,
      baseOffset: 0,
      height: 2600,
    }
  })
  return doc
}

const onlyLevel = (doc: HouseDocument) => Object.keys(doc.levels)[0] as string

test('a plan with no walls has no outline', () => {
  const doc = createEmptyDocument()
  expect(outlineOf(doc, onlyLevel(doc))).toBeUndefined()
})

test('the outline is the walls, moved to the origin', () => {
  const doc = withWalls([1000, 2000, 5000, 2000])
  expect(outlineOf(doc, onlyLevel(doc))).toEqual({
    width: 4000,
    height: 0,
    segments: [[0, 0, 4000, 0]],
  })
})

test('a room comes out as its four walls in a box of its own size', () => {
  const doc = withWalls(
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  )
  const outline = outlineOf(doc, onlyLevel(doc))
  expect(outline?.width).toBe(4000)
  expect(outline?.height).toBe(3000)
  expect(outline?.segments).toHaveLength(4)
})

test('walls on another level are not in it', () => {
  const doc = withWalls([0, 0, 4000, 0])
  expect(outlineOf(doc, 'somewhere-else')).toBeUndefined()
})
