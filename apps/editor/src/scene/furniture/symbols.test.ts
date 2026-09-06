import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const FOLDER = 'public/symbols'
const NOT_A_TAG = /<\s*\/?\s*[^a-zA-Z/!?>]/

const symbols = readdirSync(FOLDER).filter((file) => file.endsWith('.svg'))

test('there are symbols to draw with', () => {
  expect(symbols.length).toBeGreaterThan(50)
})

test('every symbol is markup a strict parser will take', () => {
  const broken = symbols.filter((file) => NOT_A_TAG.test(readFileSync(`${FOLDER}/${file}`, 'utf8')))

  expect(broken).toEqual([])
})
