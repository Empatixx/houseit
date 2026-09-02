import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { createDocumentStore } from './document-store'

const floor =
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name dům'
const kitchen = 'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m'

const roomCount = (store: ReturnType<typeof createDocumentStore>) => {
  const { doc, level } = store.getState()
  return roomsOf(doc, level).length
}

test('exec applies a script to the document', () => {
  const store = createDocumentStore()

  store.getState().exec(floor)

  expect(roomCount(store)).toBe(1)
})

test('undo takes the document back to before the last script', () => {
  const store = createDocumentStore()
  store.getState().exec(floor)

  store.getState().undo()

  expect(roomCount(store)).toBe(0)
})

test('redo reapplies a change that was undone', () => {
  const store = createDocumentStore()
  store.getState().exec(floor)
  store.getState().undo()

  store.getState().redo()

  expect(roomCount(store)).toBe(1)
})

test('a whole script undoes in one step, not one step per command', () => {
  const store = createDocumentStore()
  store.getState().exec([floor, kitchen].join('\n'))

  store.getState().undo()

  expect(roomCount(store)).toBe(0)
})

test('a new command after undo drops what could have been redone', () => {
  const store = createDocumentStore()
  store.getState().exec(floor)
  store.getState().exec(kitchen)
  store.getState().undo()

  store
    .getState()
    .exec('add-room --material natural-oak --name ložnice --from dům --side east --width 4m')

  expect(store.getState().canRedo).toBe(false)
  expect(roomCount(store)).toBe(2)
})

test('undo on a fresh document is a no-op rather than an error', () => {
  const store = createDocumentStore()

  expect(() => store.getState().undo()).not.toThrow()
  expect(store.getState().canUndo).toBe(false)
})

test('a failing script leaves the document untouched and nothing to undo', () => {
  const store = createDocumentStore()

  expect(() => store.getState().exec('no-such-command')).toThrow(/no-such-command/)
  expect(roomCount(store)).toBe(0)
  expect(store.getState().canUndo).toBe(false)
})
