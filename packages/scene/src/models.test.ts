import { OBJECT_TYPE_IDS } from '@houseit/core/object-types'
import { expect, test } from 'vitest'
import { PAINT } from './finishes'
import { modelled, piecesOf } from './models'

const part = { w: 1200, d: 700, h: 900, body: PAINT.wall, frame: PAINT.steel }

test('every type that says it is modelled builds something to look at', () => {
  const empty = OBJECT_TYPE_IDS.filter(
    (type) => modelled(type) && piecesOf(type, part).length === 0,
  )

  expect(empty).toEqual([])
})

test('a type nobody modelled builds nothing rather than throwing', () => {
  expect(modelled('rug')).toBe(false)
  expect(piecesOf('rug', part)).toEqual([])
})

test('a thing brought in as a file arrives as one model at the size it was declared', () => {
  const wardrobe = piecesOf('wardrobe', part)

  expect(wardrobe).toHaveLength(1)
  expect(wardrobe[0]?.body).toMatchObject({ kind: 'model', width: 1200, height: 900, depth: 700 })
})
