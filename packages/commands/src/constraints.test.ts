import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { measureOf } from './constraint-rules'
import { runScript } from './run'

const PLAN = [
  'add-room --material natural-oak --shape rectangle --width 9m --depth 6m --name flat',
  'add-room --material tile-white --from flat --side west --width 3m --name bath',
  'add-room --material natural-oak --from flat --side east --width 3m --name study',
].join('\n')

const built = () => runScript(createEmptyDocument(), PLAN)
const roomId = (doc: ReturnType<typeof built>, name: string) =>
  Object.values(doc.rooms).find((room) => room.name === name)!.id

test('a fixed width refuses the move that would change it and lets the others through', () => {
  const doc = runScript(built(), 'add-constraint --kind fixed --room bath --measure width')
  const held = Object.values(doc.constraints!)[0]!
  expect(held).toMatchObject({ kind: 'fixed', measure: 'width' })
  expect(() => runScript(doc, 'update-room --room bath --side east --by 300')).toThrow(
    /width of bath is fixed at \d+ mm/,
  )
  const moved = runScript(doc, 'update-room --room bath --side north --by 300')
  expect(measureOf(moved, roomId(moved, 'bath'), 'width')).toBe(
    measureOf(doc, roomId(doc, 'bath'), 'width'),
  )
})

test('a fixed length can be asked for outright, and must already hold', () => {
  expect(() =>
    runScript(built(), 'add-constraint --kind fixed --room bath --measure width --length 3.2m'),
  ).toThrow(/fixed at 3200 mm/)
})

test('equal widths are kept across a whole program, not line by line', () => {
  const doc = runScript(
    built(),
    'add-constraint --kind equal --room bath --other study --measure width',
  )
  expect(() => runScript(doc, 'update-room --room bath --side east --by 400')).toThrow(/same width/)
  const both = runScript(
    doc,
    `#!js
ctx.updateRoom({ room: 'bath', side: 'east', by: 400 })
ctx.updateRoom({ room: 'study', side: 'west', by: 400 })`,
  )
  expect(measureOf(both, roomId(both, 'bath'), 'width')).toBe(
    measureOf(both, roomId(both, 'study'), 'width'),
  )
})

test('a rule about a room that is gone goes with it, and remove-constraint lets one go', () => {
  const doc = runScript(built(), 'add-constraint --kind fixed --room bath --measure depth')
  expect(runScript(doc, 'remove-room --room bath --into flat').constraints).toBeUndefined()
  const id = Object.keys(doc.constraints!)[0]!
  expect(runScript(doc, `remove-constraint --id ${id}`).constraints).toBeUndefined()
})

test('every answer reads the rules back with what they measure now', () => {
  const doc = runScript(built(), 'add-constraint --kind fixed --room bath --measure width')
  const answer = askPlan(doc, 'get-plan')
  expect(answer.constraints).toEqual([
    expect.objectContaining({ kind: 'fixed', holds: true, now: expect.any(Number) }),
  ])
})
