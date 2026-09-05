import type { Answer } from '@houseit/commands/answer'
import type { ObjectReport, RoomReport } from '@houseit/commands/survey'
import { expect, test } from 'vitest'
import { viewOf } from './view-of'

const room = (name: string, objects: Partial<ObjectReport>[] = []): RoomReport =>
  ({ id: 'r1', name, objects: objects as ObjectReport[] }) as RoomReport

const answer = (rooms: RoomReport[], changed: string[] = []): Answer =>
  ({ level: 'l1', changed, rooms, problems: [] }) as Answer

test('one room touched is a picture of that room', () => {
  expect(viewOf(answer([room('kitchen')], ['r1']))).toEqual({ room: 'kitchen' })
})

test('one thing changed in it is a picture of that thing, in its room', () => {
  const kitchen = room('kitchen', [{ id: 'f7' }, { id: 'f8' }])

  expect(viewOf(answer([kitchen], ['f7']))).toEqual({ room: 'kitchen', object: 'f7' })
})

test('two things changed in one room is a picture of the room, not of either', () => {
  const kitchen = room('kitchen', [{ id: 'f7' }, { id: 'f8' }])

  expect(viewOf(answer([kitchen], ['f7', 'f8']))).toEqual({ room: 'kitchen' })
})

test('several rooms touched is the whole level, with every dimension on it', () => {
  expect(viewOf(answer([room('kitchen'), room('hall')], ['r1', 'r2']))).toEqual({
    dimensions: true,
  })
})

test('nothing to point at is still the whole level rather than nothing', () => {
  expect(viewOf(answer([]))).toEqual({ dimensions: true })
})
