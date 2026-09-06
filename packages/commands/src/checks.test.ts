import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'

const check = (script: string) => askPlan(createEmptyDocument(), script)
const codes = (script: string) => check(script).problems.map((problem) => problem.code)
const ok = (script: string) => check(script).problems.every((it) => it.severity !== 'error')

const HOUSE =
  'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house'

test('a house with one room and a front door is fine', () => {
  const script = `${HOUSE}\nadd-opening --kind door --room house --side south`

  expect(ok(script)).toBe(true)
  expect(check(script).problems).toEqual([])
})

test('a house nobody can get into, and a room nobody can get to', () => {
  const script = [
    HOUSE,
    'add-room --material natural-oak --name bedroom --from house --side west --width 4m',
    'add-opening --kind window --room bedroom --side north',
  ].join('\n')

  expect(codes(script)).toContain('house.no-entrance')
  expect(codes(script)).toContain('room.no-door')
  expect(codes(`${script}\nadd-opening --kind door --room house --side south`)).toContain(
    'room.no-door',
  )
  expect(
    codes(
      `${script}\nadd-opening --kind door --room house --side south\nadd-opening --kind door --room bedroom --side east`,
    ),
  ).toEqual([])
})

test('a bedroom opening straight into the living room is called out, a hall between is not', () => {
  const script = [
    HOUSE,
    'add-room --material natural-oak --name living --from house --side west --width 6m',
    'add-room --material natural-oak --name bedroom --from house --side north --width 4m',
    'add-opening --kind door --room living --side south',
    'add-opening --kind door --room bedroom --side west',
    'add-opening --kind window --room bedroom --side north',
    'add-opening --kind window --room living --side south',
  ].join('\n')

  expect(codes(script)).toContain('room.opens-to-public')
  expect(check(script).problems.find((it) => it.code === 'room.opens-to-public')?.room).toBe(
    'bedroom',
  )
})

test('a room too small or too dark for what it is called', () => {
  const script = [
    HOUSE,
    'add-room --material natural-oak --name hall --from house --side north --width 1.5m',
    'add-room --material natural-oak --name laundry --from hall --side west --width 1.5m',
    'add-room --material natural-oak --name bedroom --from house --side east --width 4m',
    'add-opening --kind door --room house --side south',
    'add-opening --kind door --room hall --side south',
    'add-opening --kind door --room laundry --side east',
    'add-opening --kind door --room bedroom --side west',
  ].join('\n')
  const report = check(script)

  expect(ok(script)).toBe(true)
  expect(report.problems.map((it) => `${it.code}:${it.room}`)).toEqual(
    expect.arrayContaining(['room.too-small:laundry', 'window.missing:bedroom']),
  )
})

test('a door that cannot open for what stands in its swing', () => {
  const script = [
    HOUSE,
    'add-opening --kind door --room house --side south',
    'add-object --room house --type sofa-3 --against south --along 0.5',
  ].join('\n')
  const report = check(script)

  const blocked = report.problems.find((it) => it.code === 'door.blocked')
  expect(blocked?.message).toMatch(/sofa/)
  expect(ok(script)).toBe(false)
})

test('a kitchen with nothing to cook on', () => {
  const script = [
    HOUSE,
    'add-room --material tile-white --name kitchen --from house --side west --width 4m',
    'add-opening --kind door --room house --side south',
    'add-opening --kind door --room kitchen --side east',
    'add-opening --kind window --room kitchen --side north',
    'add-object --room kitchen --type refrigerator --against north',
  ].join('\n')

  const problem = check(script).problems.find((it) => it.code === 'kitchen.incomplete')
  expect(problem?.message).toMatch(/no a sink, no a stove/)
})

test('errors come before warnings, and the answer is plain data', () => {
  const script = [
    HOUSE,
    'add-room --material natural-oak --name bedroom --from house --side west --width 4m',
    'add-opening --kind door --room house --side south',
  ].join('\n')
  const report = check(script)

  const severities = report.problems.map((it) => it.severity)
  expect(severities.indexOf('warning')).toBeGreaterThanOrEqual(severities.lastIndexOf('error'))
  expect(JSON.parse(JSON.stringify(report))).toEqual(report)
})

test('the trouble is told to the command that caused it, not to a later question', () => {
  const script = [
    HOUSE,
    'add-opening --kind door --room house --side south',
    'add-object --room house --type sofa-3 --against south --along 0.5',
  ].join('\n')

  expect(codes(script)).toContain('door.blocked')
})

const ROOM = 'add-room --material ash --shape rectangle --width 5m --depth 5m --name room'
const atDoor = (across: number) =>
  [
    ROOM,
    'add-opening --kind door --room room --side south --along 0.5 --variant pocket',
    `add-object --room room --type box --width 600 --depth 600 --along 0.5 --across ${across}`,
  ].join('\n')

test('something a shoulder away from a door is not standing in the way of it', () => {
  expect(codes(atDoor(0.21))).not.toContain('door.no-approach')
})

test('something right in front of a door is', () => {
  expect(codes(atDoor(0.15))).toContain('door.no-approach')
})
