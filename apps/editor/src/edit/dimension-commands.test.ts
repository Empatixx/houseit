import { roomDimensions } from '@houseit/geometry/dimensions'
import { roomsOf } from '@houseit/geometry/rooms'
import { beforeEach, expect, test } from 'vitest'
import { documentStore } from '../store/store'
import { setDimension } from './dimension-commands'

beforeEach(() => documentStore.getState().reset())

const dimensionsOf = (name: string) => {
  const { doc, level } = documentStore.getState()
  const room = roomsOf(doc, level).find((it) => it.name === name)!
  return roomDimensions(doc, level, room)
}

test('typing a room dimension moves one wall so the side measures exactly that, in one undo step', () => {
  documentStore
    .getState()
    .exec(
      'add-room --name flat --shape rectangle --width 8m --depth 6m --material natural-oak\nadd-room --name bath --from flat --corner north-west --width 2.4m --depth 2m --material tile-white',
    )
  const before = documentStore.getState()
  const side = dimensionsOf('bath').find((it) => it.length === 2400 - 150 / 2 - 300 / 2)
  expect(side?.ends).toBeDefined()
  expect(setDimension(side!, 2600)).toBe(true)
  const lengths = dimensionsOf('bath').map((it) => it.length)
  expect(lengths).toContain(2600)
  expect(documentStore.getState().past.length).toBe(before.past.length + 1)
  documentStore.getState().undo()
  expect(documentStore.getState().doc).toEqual(before.doc)
})
