import * as standing from '@houseit/commands/standing-check'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { previewStore } from '../store/preview'
import { documentStore } from '../store/store'
import { endPreview, schedulePreview } from './preview'
import { moveWallBy, previewWallMove } from './wall-commands'

beforeEach(() => {
  vi.useFakeTimers()
  endPreview()
  documentStore.getState().reset()
  documentStore
    .getState()
    .exec(
      [
        'add-room --name Room --width 8000 --depth 6000 --material natural-oak',
        'add-object --room Room --type dining-round-4 --along 0.5 --across 0.5',
      ].join('\n'),
    )
})

afterEach(() => {
  endPreview()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const north = () => {
  const { doc } = documentStore.getState()
  return Object.values(doc.walls).find(
    (w) => doc.nodes[w.a]!.y === 6000 && doc.nodes[w.b]!.y === 6000,
  )!
}

test.each(['room', 'wall'])(
  'a %s drop validates furniture again after a cached preview, then undoes as one step',
  (kind) => {
    const wall = north(),
      before = documentStore.getState()
    const room = kind === 'room' ? Object.keys(before.doc.rooms)[0] : undefined
    const check = vi.spyOn(standing, 'standingProblem')
    previewWallMove(wall, { x: 0, y: -3000 }, room)
    expect(check).not.toHaveBeenCalled()
    expect(previewStore.getState().doc!.nodes[wall.a]!.y).toBe(3000)
    expect(documentStore.getState().doc).toBe(before.doc)
    expect(documentStore.getState().past).toBe(before.past)
    endPreview()
    expect(moveWallBy(wall, { x: 0, y: -3000 }, room)).toBe(true)
    expect(check).toHaveBeenCalled()
    expect(documentStore.getState().doc.nodes[wall.a]!.y).toBeGreaterThan(3000)
    expect(documentStore.getState().past).toHaveLength(before.past.length + 1)
    documentStore.getState().undo()
    expect(documentStore.getState().doc).toEqual(before.doc)
  },
)

test('multiple pointer samples render only the latest preview in a frame', () => {
  const wall = north()
  const shown = vi.fn()
  const unsubscribe = previewStore.subscribe(shown)
  schedulePreview(() => previewWallMove(wall, { x: 0, y: 300 }))
  schedulePreview(() => previewWallMove(wall, { x: 0, y: 600 }))
  expect(previewStore.getState().doc).toBeNull()
  vi.advanceTimersToNextFrame()
  expect(shown).toHaveBeenCalledTimes(1)
  expect(previewStore.getState().doc!.nodes[wall.a]!.y).toBe(6600)
  unsubscribe()
})

test('ending a drag cancels a queued preview', () => {
  const wall = north()
  schedulePreview(() => previewWallMove(wall, { x: 0, y: 600 }))
  endPreview()
  moveWallBy(wall, { x: 0, y: 600 })
  vi.advanceTimersToNextFrame()
  expect(previewStore.getState().doc).toBeNull()
  expect(documentStore.getState().doc.nodes[wall.a]!.y).toBe(6600)
})
