import { beforeEach, expect, test, vi } from 'vitest'
import { drawStore } from '../store/draw'
import { engineViewStore } from '../store/engine-view'
import { selectionStore } from '../store/selection'
import { documentStore } from '../store/store'
import { toolStore } from '../store/tool'
import { aimAt, cancelDrawing, putDown, putTyped, typedLength, typeKey } from './draw-commands'

vi.mock('../engine/native-tools', () => ({ activeTools: null }))

beforeEach(() => {
  cancelDrawing()
  toolStore.getState().arm(null)
  documentStore.getState().reset()
  selectionStore.getState().select(null)
  engineViewStore.setState({ snap: false })
})
const click = (x: number, y: number) => {
  aimAt({ x, y })
  putDown({ x, y })
}

test('a closed pencil outline immediately becomes a selected room in one native undo step', () => {
  const before = documentStore.getState(),
    graph = structuredClone(before.authoring.graph)
  toolStore.getState().arm({ kind: 'wall' })
  click(0, 0)
  click(6000, 0)
  click(6000, 4000)
  click(0, 4000)
  expect(documentStore.getState().doc).toBe(before.doc)
  click(0, 0)
  const after = documentStore.getState()
  const room = Object.values(after.doc.rooms)[0]!
  expect(Object.keys(after.doc.rooms)).toHaveLength(1)
  expect(room.floor).toBe('natural-oak')
  expect(room.loop).toHaveLength(4)
  expect(selectionStore.getState().selected).toEqual({ kind: 'room', id: room.id })
  expect(toolStore.getState().armed).toBeNull()
  expect(drawStore.getState().points).toEqual([])
  expect(after.past.length).toBe(before.past.length + 1)
  documentStore.getState().undo()
  expect(documentStore.getState().doc).toEqual(before.doc)
  expect(documentStore.getState().authoring.graph).toEqual(graph)
  documentStore.getState().redo()
  expect(documentStore.getState().doc).toEqual(after.doc)
})

test('joining two existing walls finishes a partition without Enter and preserves the existing room', () => {
  documentStore
    .getState()
    .exec('add-room --shape rectangle --width 8000 --depth 6000 --name Living --material beech')
  const before = documentStore.getState(),
    existing = Object.keys(before.doc.rooms)[0]!,
    graph = structuredClone(before.authoring.graph)
  toolStore.getState().arm({ kind: 'wall' })
  click(4000, 6000)
  click(4000, 0)
  const after = documentStore.getState()
  expect(Object.keys(after.doc.rooms)).toHaveLength(2)
  expect(after.doc.rooms[existing]!.name).toBe('Living')
  const room = Object.values(after.doc.rooms).find((r) => r.id !== existing)!
  expect(room.floor).toBe('beech')
  expect(selectionStore.getState().selected).toEqual({ kind: 'room', id: room.id })
  expect(toolStore.getState().armed).toBeNull()
  expect(after.past.length).toBe(before.past.length + 1)
  documentStore.getState().undo()
  expect(documentStore.getState().doc).toEqual(before.doc)
  expect(documentStore.getState().authoring.graph).toEqual(graph)
})

test('an open outline remains in progress and Escape-style cancellation creates no room or history', () => {
  const before = documentStore.getState()
  toolStore.getState().arm({ kind: 'wall' })
  click(0, 0)
  click(6000, 0)
  click(6000, 4000)
  expect(toolStore.getState().armed).toEqual({ kind: 'wall' })
  expect(drawStore.getState().points).toHaveLength(3)
  expect(documentStore.getState().doc).toBe(before.doc)
  cancelDrawing()
  expect(documentStore.getState().doc).toBe(before.doc)
  expect(documentStore.getState().past).toBe(before.past)
})

test('automatic room creation uses the active storey for preview and commit', () => {
  documentStore.getState().exec('add-level --name Upper')
  const upper = Object.values(documentStore.getState().doc.levels).find(
    (level) => level.name === 'Upper',
  )!
  documentStore.getState().setLevel(upper.id)
  toolStore.getState().arm({ kind: 'wall' })
  click(0, 0)
  click(6000, 0)
  click(6000, 4000)
  click(0, 4000)
  click(0, 0)
  const doc = documentStore.getState().doc
  expect(Object.values(doc.rooms).map((room) => room.level)).toEqual([upper.id])
  expect(Object.values(doc.walls).every((wall) => wall.level === upper.id)).toBe(true)
})

test('a length typed while drawing places the next corner exactly that far along the aimed axis', () => {
  toolStore.getState().arm({ kind: 'wall' })
  click(0, 0)
  aimAt({ x: 1234, y: 80 })
  for (const key of '4.2') typeKey(key)
  expect(drawStore.getState().cursor).toEqual({ x: 4200, y: 0 })
  expect(putTyped()).toBe(true)
  aimAt({ x: 4150, y: -900 })
  for (const key of '3000') typeKey(key)
  typeKey('Backspace')
  typeKey('0')
  putTyped()
  expect(drawStore.getState().points).toEqual([
    { x: 0, y: 0 },
    { x: 4200, y: 0 },
    { x: 4200, y: -3000 },
  ])
  for (const key of '4200') typeKey(key)
  aimAt({ x: 100, y: -3100 })
  putTyped()
  for (const key of '3m') typeKey(key)
  aimAt({ x: -50, y: 0 })
  putTyped()
  const room = Object.values(documentStore.getState().doc.rooms)[0]
  expect(room).toBeDefined()
  expect(drawStore.getState().points).toEqual([])
})

test('typed lengths read as millimetres unless they are small or decimal', () => {
  expect(typedLength('3600')).toBe(3600)
  expect(typedLength('3,6')).toBe(3600)
  expect(typedLength('4')).toBe(4000)
  expect(typedLength('360cm')).toBe(3600)
  expect(typedLength('2.4m')).toBe(2400)
  expect(typedLength('m')).toBeUndefined()
  expect(typedLength('')).toBeUndefined()
})
