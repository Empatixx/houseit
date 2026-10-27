import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { produce } from 'immer'
import { expect, test } from 'vitest'
import { applyScript } from './apply-script'
import { isProgram, programHelp, signatureOf } from './program'
import { runScript } from './run'

const outcome = (doc: HouseDocument, source: string) => {
  let said: ReturnType<typeof applyScript> = { changed: [], shown: [] }
  const next = produce(doc, (draft) => {
    said = applyScript(draft, source)
  })
  return { next, said }
}

const lines = [
  'add-room --name house --width 10m --depth 6m --material natural-oak',
  'add-room --name kitchen --from house --side west --width 3m --material tile-white',
].join('\n')

test('a program builds the same plan as the command lines it stands for', () => {
  const program = `#!js
ctx.addRoom({ name: 'house', width: '10m', depth: 6000, material: 'natural-oak' })
ctx.addRoom({ name: 'kitchen', from: 'house', side: 'west', width: '3m', material: 'tile-white' })`
  const empty = createEmptyDocument()
  const byLines = runScript(empty, lines)
  const byProgram = runScript(empty, program)
  expect(byProgram).toEqual(byLines)
})

test('a program reads back what it made and returns a value', () => {
  const { said } = outcome(
    createEmptyDocument(),
    `export default (ctx) => {
  ctx.run(${JSON.stringify(lines)})
  const sofa = ctx.addObject({ room: 'house', type: 'sofa-3', against: 'north' })
  const rooms = ctx.rooms().map((room) => room.name).sort()
  ctx.log('placed', sofa.id)
  return { sofa: sofa.id, rooms, area: Math.round(ctx.room('kitchen').area) }
}`,
  )
  expect(said.result).toMatchObject({ rooms: ['house', 'kitchen'] })
  expect((said.result as { sofa: string }).sofa).toMatch(/^f/)
  expect(said.logs).toEqual([`placed ${(said.result as { sofa: string }).sofa}`])
  expect(said.changed.length).toBeGreaterThan(2)
})

test('loops and conditions run inside one transaction that a failure throws away', () => {
  const doc = runScript(createEmptyDocument(), lines)
  const failing = `#!js
for (const side of ['north', 'south']) ctx.addObject({ room: 'house', type: 'club-chair', against: side })
ctx.addObject({ room: 'nowhere', type: 'club-chair', against: 'north' })`
  expect(() => runScript(doc, failing)).toThrow(/nowhere/)
  expect(Object.keys(doc.objects)).toHaveLength(0)
})

test('the document handed to a program is a copy, not the draft', () => {
  const doc = runScript(createEmptyDocument(), lines)
  const next = runScript(
    doc,
    `#!js
const copy = ctx.doc()
for (const room of Object.values(copy.rooms)) room.name = 'renamed'`,
  )
  expect(Object.values(next.rooms).map((room) => room.name)).not.toContain('renamed')
})

test('a program is refused what would make it more than one synchronous transaction', () => {
  const doc = createEmptyDocument()
  expect(() => runScript(doc, "#!js\nimport fs from 'node:fs'")).toThrow(/import/)
  expect(() => runScript(doc, '#!js\nreturn (async () => 1)()')).toThrow(/promise/)
  expect(() => runScript(doc, '#!js\nreturn typeof window + typeof fetch')).not.toThrow()
  expect(outcome(doc, '#!js\nreturn [typeof window, typeof fetch]').said.result).toEqual([
    'undefined',
    'undefined',
  ])
  expect(() => runScript(doc, '#!js\nctx.addRoom("house")')).toThrow(/one object/)
})

test('command lines are not mistaken for a program', () => {
  expect(isProgram(lines)).toBe(false)
  expect(isProgram('#!js\nreturn 1')).toBe(true)
  expect(isProgram('  export default (ctx) => 1')).toBe(true)
})

test('help names every command as a function with its options', () => {
  expect(signatureOf('add-room')).toMatch(
    /^ctx\.addRoom\(\{ name: string, at\?: \{ x: length, y: length \}.*width\?: length.*material: string/,
  )
  expect(signatureOf('addRoom')).toBe(signatureOf('add-room'))
  expect(programHelp()).toContain('ctx.updateWall(')
})

test('reads are remembered until the next write and handed out as copies', () => {
  const { said } = outcome(
    runScript(createEmptyDocument(), lines),
    `#!js
const first = ctx.rooms()
first[0].name = 'scribbled'
const again = ctx.rooms()
ctx.updateRoom({ room: 'kitchen', name: 'cook' })
const after = ctx.rooms().map((room) => room.name).sort()
return { again: again.map((room) => room.name).sort(), after, same: ctx.problems() === ctx.problems() }`,
  )
  expect(said.result).toEqual({
    again: ['house', 'kitchen'],
    after: ['cook', 'house'],
    same: false,
  })
})

test('a program can read things, walls and rules, and ask for a brief answer', () => {
  const { said } = outcome(
    runScript(createEmptyDocument(), lines),
    `#!js
const sofa = ctx.addObject({ room: 'house', type: 'sofa-3', against: 'north' })
ctx.addConstraint({ kind: 'fixed', room: 'kitchen', measure: 'width' })
ctx.brief()
const wall = ctx.wall(ctx.room('kitchen').walls[0].id)[0]
return {
  things: ctx.objects().map((it) => [it.id, it.type, it.room]),
  sofa: sofa.id,
  wall: [wall.thickness, wall.length > 0],
  rules: ctx.constraints().map((it) => [it.kind, it.holds]),
}`,
  )
  const result = said.result as { sofa: string }
  expect(said.result).toEqual({
    things: [[result.sofa, 'sofa-3', 'house']],
    sofa: result.sofa,
    wall: [expect.any(Number), true],
    rules: [['fixed', true]],
  })
  expect(said.brief).toBe(true)
})
