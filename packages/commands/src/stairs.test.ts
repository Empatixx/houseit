import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const HOUSE = [
  'add-room --shape rectangle --width 8m --depth 7m --material natural-oak --name přízemí',
  'add-opening --room přízemí --kind door --side south',
].join('\n')

const UPSTAIRS = [
  'add-level --name "1. patro"',
  'add-room --shape rectangle --width 8m --depth 7m --material white-oak --name patro --level "1. patro"',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const twoStoreys = () => runScript(house(), UPSTAIRS)
const stairs = (doc: HouseDocument) =>
  Object.values(doc.objects).find((it) => it.type.startsWith('stairs-'))!
const codes = (doc: HouseDocument, source = 'get-plan') =>
  askPlan(doc, source).problems.map((it) => it.code)

test('a flight is as long as the storey makes it, and its length is not asked for', () => {
  const doc = runScript(
    twoStoreys(),
    'add-object --room přízemí --type stairs-straight --against east',
  )

  expect(stairs(doc)).toMatchObject({ width: 900, depth: 15 * 280 })
  expect(() =>
    runScript(twoStoreys(), 'add-object --room přízemí --type stairs-straight --depth 3m'),
  ).toThrow(/as long as the storey makes it — 4200 mm for 16 risers/)
})

test('a taller storey makes a longer flight of the very same command', () => {
  const tall = runScript(twoStoreys(), 'update-level --height 3.4m')
  const doc = runScript(tall, 'add-object --room přízemí --type stairs-straight --against east')

  expect(stairs(doc).depth).toBeGreaterThan(15 * 280)
})

test('the width asked for is the flight, and a U is two of them side by side', () => {
  const doc = runScript(
    twoStoreys(),
    'add-object --room přízemí --type stairs-u --against north --width 1m',
  )

  expect(stairs(doc).width).toBe(2000)
})

test('a flight with no storey above it has nowhere to go, and says so', () => {
  const alone = runScript(
    house(),
    'add-object --room přízemí --type stairs-straight --against east',
  )

  expect(codes(alone)).toContain('stairs.nowhere')
  const built = runScript(alone, UPSTAIRS)
  expect(codes(built)).not.toContain('stairs.nowhere')
})

test('a staircase is a hole in the floor above, and the room above says so', () => {
  const doc = runScript(
    twoStoreys(),
    'add-object --room přízemí --type stairs-u --against north --along 0.2',
  )

  const upstairs = askPlan(doc, 'get-plan --room patro').rooms[0]!
  expect(upstairs.wells).toHaveLength(1)
  expect(upstairs.wells![0]).toMatchObject({ type: 'stairs-u' })
  expect(askPlan(doc, 'get-plan --room přízemí').rooms[0]!.wells).toBeUndefined()
})

test('what stands over a stairwell is told, whichever storey it was put there from', () => {
  const doc = runScript(
    twoStoreys(),
    'add-object --room přízemí --type stairs-u --against north --along 0.2',
  )
  const over = 'add-object --room patro --type dresser --against north --along 0.2'

  expect(askPlan(doc, over).problems.map((it) => it.code)).toContain('stairs.well-blocked')
  const blocked = runScript(doc, over)
  expect(codes(blocked, 'get-plan --room přízemí')).toContain('stairs.well-blocked')
})

test('a room is found on whatever storey it is on, without being told which', () => {
  const doc = twoStoreys()

  expect(() =>
    runScript(doc, 'add-object --room patro --type queen-bed --against north'),
  ).not.toThrow()
  expect(() => runScript(doc, 'add-object --room patro --type queen-bed --level přízemí')).toThrow(
    /no storey called přízemí/,
  )
})

test('a thing is changed by its id without its storey being named', () => {
  const doc = runScript(twoStoreys(), 'add-object --room patro --type queen-bed --against north')
  const bed = Object.values(doc.objects)[0]!

  const moved = runScript(doc, `update-object --id ${bed.id} --against south`)
  expect(moved.objects[bed.id]!.against).toBe('south')
  expect(runScript(moved, `remove-object --id ${bed.id}`).objects).toEqual({})
})
