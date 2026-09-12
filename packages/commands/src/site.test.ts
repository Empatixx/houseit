import { readFileSync } from 'node:fs'
import { createEmptyDocument, parseDocument } from '@houseit/core/document'
import { siteHeight } from '@houseit/core/site'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const source = readFileSync(
  new URL('../../../fixtures/building-proof/site.txt', import.meta.url),
  'utf8',
)
test('site and external supports survive the CLI and document roundtrip without creating rooms', () => {
  const doc = parseDocument(JSON.parse(JSON.stringify(runScript(createEmptyDocument(), source))))
  const answer = askPlan(doc, 'get-plan --level Ground')
  expect(answer.rooms).toHaveLength(1)
  expect(answer.site?.surfaces).toHaveLength(2)
  const [walk, bay] = doc.site!.surfaces
  expect(siteHeight(walk!, 0, 6000)).toBe(siteHeight(bay!, 0, 6000))
  expect(siteHeight(bay!, 0, 10000)).toBe(-180)
  expect(answer.levels[0]!.columns?.[0]).toMatchObject({ outside: true, height: 2900 })
  expect(() =>
    runScript(
      doc,
      'add-column --level Ground --x 7000 --y 4000 --width 500 --depth 500 --colour "#ffffff"',
    ),
  ).toThrow('inside the storey footprint')
})
