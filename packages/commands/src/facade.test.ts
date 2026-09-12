import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { runScript } from './run'

const source = readFileSync(
  new URL('../../../fixtures/building-proof/facade-continuity.txt', import.meta.url),
  'utf8',
)
test('a room can dress one exterior side without moving walls or repainting its other sides', () => {
  const doc = runScript(createEmptyDocument(), source)
  const lower = Object.values(doc.levels).find((l) => l.name === 'Lower')!
  const walls = Object.values(doc.walls).filter((w) => w.level === lower.id)
  for (const w of walls.filter((w) => doc.nodes[w.a]!.y === -100 && doc.nodes[w.b]!.y === -100)) {
    expect(w.exterior?.bands).toEqual([{ from: 0, to: 3300, colour: '#7a7b7a' }])
  }
  const west = walls.find((w) => doc.nodes[w.a]!.x === -100 && doc.nodes[w.b]!.x === -100)!
  expect(west.exterior?.bands).toEqual([])
  const updated = runScript(
    doc,
    `update-room --room West --wall ${west.id} --exterior '{"layers":[{"name":"coat","thickness":212}],"colour":"#123456"}'`,
  )
  expect(updated.walls[west.id]!.exterior?.colour).toBe('#123456')
  expect(updated.nodes).toEqual(doc.nodes)
  const shared = walls.find((w) => doc.nodes[w.a]!.x === 4000 && doc.nodes[w.b]!.x === 4000)!
  expect(shared.exterior).toBeUndefined()
  expect(() =>
    runScript(
      doc,
      `update-room --room West --wall ${shared.id} --exterior '{"layers":[{"name":"coat","thickness":212}],"colour":"#123456"}'`,
    ),
  ).toThrow('no exterior walls')
})
