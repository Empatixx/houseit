import { expect, test } from 'vitest'
import { commandLine } from './command-line'
import { scriptLines } from './script-lines'

test('a line reads back as the words it was built from', () => {
  const line = commandLine('move-object', {
    room: 'master bedroom',
    type: 'nightstand',
    nth: 2,
    against: 'north',
    along: 0.125,
    across: undefined,
    level: undefined,
  })

  expect(scriptLines(line)).toEqual([
    [
      'move-object',
      '--room',
      'master bedroom',
      '--type',
      'nightstand',
      '--nth',
      '2',
      '--against',
      'north',
      '--along',
      '0.125',
    ],
  ])
})

test('a name with a quote in it survives the round trip', () => {
  const line = commandLine('describe', { room: `Jirka's "den"` })

  expect(scriptLines(line)[0]).toEqual(['describe', '--room', `Jirka's "den"`])
})

test('a flag is a bare word, and a false flag is nothing', () => {
  expect(commandLine('add-door', { room: 'hall', swings: true, glazed: false })).toBe(
    'add-door --room hall --swings',
  )
})
