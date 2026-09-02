import { expect, test } from 'vitest'
import { viewOf } from './view-of'

test('a script that only edits asks for no picture', () => {
  expect(viewOf('add-door --room kitchen --side south')).toBeUndefined()
})

test('a describe of a room is a picture of that room', () => {
  expect(viewOf('describe --room kitchen')).toEqual({ room: 'kitchen', dimensions: false })
})

test('a measure of a thing is a picture of that thing, in its room', () => {
  expect(viewOf('measure --room kitchen --type sofa-3')).toEqual({
    room: 'kitchen',
    type: 'sofa-3',
    dimensions: true,
  })
})

test('a measure of the whole plan shows every dimension', () => {
  expect(viewOf('measure')).toEqual({ dimensions: true })
})

test('the last look in a script is the one pictured', () => {
  const script = [
    'describe --room hall',
    'add-window --room kitchen --side north',
    'describe --room kitchen',
  ].join('\n')

  expect(viewOf(script)).toMatchObject({ room: 'kitchen' })
})

test('a line the command would refuse asks for nothing', () => {
  expect(viewOf('describe --colour blue')).toBeUndefined()
})
