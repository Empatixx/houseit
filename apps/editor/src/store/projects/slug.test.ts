import { expect, test } from 'vitest'
import { slugOf } from './slug'

test('a name becomes a readable id', () => {
  expect(slugOf('Byt Praha', [])).toBe('byt-praha')
})

test('accents and punctuation come out as plain words', () => {
  expect(slugOf('Chata u Sázavy!', [])).toBe('chata-u-sazavy')
})

test('an id already taken gets a number', () => {
  expect(slugOf('Byt', ['byt'])).toBe('byt-2')
  expect(slugOf('Byt', ['byt', 'byt-2'])).toBe('byt-3')
})

test('a name with nothing usable in it still gets an id', () => {
  expect(slugOf('...', [])).toBe('project')
  expect(slugOf('...', ['project'])).toBe('project-2')
})

test('a name too long for an address is cut short', () => {
  expect(slugOf('a'.repeat(80), []).length).toBe(48)
})
