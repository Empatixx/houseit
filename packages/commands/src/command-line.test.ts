import { expect, test } from 'vitest'
import { quoted } from './command-line'
import { scriptLines } from './script-lines'

test('a word with a space or a quote in it reads back as the one word', () => {
  const line = ['describe', '--room', `Jirka's "master bedroom"`].map(quoted).join(' ')

  expect(scriptLines(line)[0]).toEqual(['describe', '--room', `Jirka's "master bedroom"`])
})

test('a plain word is left alone', () => {
  expect(quoted('kitchen')).toBe('kitchen')
  expect(quoted('')).toBe('""')
})
