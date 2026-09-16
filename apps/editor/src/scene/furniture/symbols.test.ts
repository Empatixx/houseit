import { readdirSync, readFileSync } from 'node:fs'
import { OBJECT_TYPES } from '@houseit/core/object-types'
import { expect, test } from 'vitest'

const FOLDER = 'public/symbols'
const NOT_A_TAG = /<\s*\/?\s*[^a-zA-Z/!?>]/

const symbols = readdirSync(FOLDER).filter((file) => file.endsWith('.svg'))

test('there are symbols to draw with', () => {
  expect(symbols.length).toBeGreaterThan(50)
})

test('every catalogue symbol has an SVG asset, including imported furniture', () => {
  for (const type of OBJECT_TYPES) {
    if (type.symbol) expect(symbols, type.id).toContain(type.symbol)
  }
})

test('every symbol is markup a strict parser will take', () => {
  const broken = symbols.filter((file) => NOT_A_TAG.test(readFileSync(`${FOLDER}/${file}`, 'utf8')))

  expect(broken).toEqual([])
})
