import { expect, test } from 'vitest'
import { parseLength } from './length'

test('a bare number is millimetres, as on a building drawing', () => {
  expect(parseLength('3600')).toBe(3600)
  expect(parseLength(3600)).toBe(3600)
})

test('metres are the unit people speak in', () => {
  expect(parseLength('3.6m')).toBe(3600)
  expect(parseLength('12 m')).toBe(12_000)
})

test('centimetres work too', () => {
  expect(parseLength('360cm')).toBe(3600)
})

test('an explicit mm suffix is allowed', () => {
  expect(parseLength('3600mm')).toBe(3600)
})

test('a decimal comma is accepted, because that is how it is written here', () => {
  expect(parseLength('3,6m')).toBe(3600)
})

test('the result is always whole millimetres', () => {
  expect(parseLength('3.60049m')).toBe(3600)
})

test('nonsense is refused', () => {
  expect(() => parseLength('wide')).toThrow()
  expect(() => parseLength('3.6 furlongs')).toThrow()
})
