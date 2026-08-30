import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { fitsInside } from '@houseit/geometry/fits'
import { roomsOf } from '@houseit/geometry/rooms'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { expect, test } from 'vitest'
import { runScript } from './run'

const room = () => ({
  doc: runScript(
    createEmptyDocument(),
    'floor-shape --material oak --kind rectangle --width 6m --depth 4m --name pokoj',
  ),
})
const things = (doc: HouseDocument) => Object.values(doc.objects)

test('something put in a room belongs to that room, at its own size', () => {
  const next = runScript(room().doc, 'add-object --room pokoj --type table')

  expect(things(next)).toEqual([
    expect.objectContaining({ type: 'table', width: 1600, depth: 900, surface: 'oak', seats: 6 }),
  ])
})

test('a second thing lands beside the first, not inside it', () => {
  const next = runScript(
    room().doc,
    ['add-object --room pokoj --type chair', 'add-object --room pokoj --type chair'].join('\n'),
  )
  const [first, second] = things(next)

  expect(Math.abs(first!.along - second!.along) * 6000).toBeGreaterThanOrEqual(460)
})

test('size, surface and places can all be given', () => {
  const next = runScript(
    room().doc,
    'add-object --room pokoj --type table --surface marble --width 2.4m --depth 1.1m --seats 8',
  )

  expect(things(next)).toEqual([
    expect.objectContaining({ surface: 'marble', width: 2400, depth: 1100, seats: 8 }),
  ])
})

test('a surface the thing never comes in is refused, and says what it does come in', () => {
  expect(() =>
    runScript(room().doc, 'add-object --room pokoj --type chair --surface glass'),
  ).toThrow(/oak/)
})

test('a thing too big for the room is refused', () => {
  expect(() => runScript(room().doc, 'add-object --room pokoj --type table --width 9m')).toThrow(
    /does not fit/,
  )
})

test('putting something in a room that does not exist says so', () => {
  expect(() => runScript(room().doc, 'add-object --room garáž --type chair')).toThrow(/garáž/)
})

test('a rug goes in the middle and is in nobody way', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type rug --surface blue',
      'add-object --room pokoj --type table',
    ].join('\n'),
  )
  const [rug, table] = things(next)

  expect(rug!.along).toBe(0.5)
  expect(table!.along).toBe(0.5)
})

test('two rugs move over for one another rather than stacking', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type rug --surface blue --width 1.5m --depth 1m',
      'add-object --room pokoj --type rug --surface rust --width 1.5m --depth 1m',
    ].join('\n'),
  )
  const [one, other] = things(next)

  expect(Math.abs(one!.along - other!.along) * 6000).toBeGreaterThanOrEqual(1500)
})

/** An 8 by 6 room with a bite out of the north-east, leaving an L. */
const ell = (bite: string) => ({
  doc: runScript(
    createEmptyDocument(),
    [
      'floor-shape --material oak --kind rectangle --width 8m --depth 6m --name pokoj',
      `add-room --material oak --name kout --from pokoj --corner north-east ${bite}`,
    ].join('\n'),
  ),
})

test('a thing too big to fit inside the room is refused, not left hanging out of it', () => {
  // The room is 6 by 4: five metres across is fine, four and a half deep is not.
  expect(() =>
    runScript(room().doc, 'add-object --room pokoj --type rug --width 5m --depth 4.5m'),
  ).toThrow(/does not fit/)
})

test('a thing laid across the waist of an L is refused', () => {
  // The bite leaves the room four metres wide where this would land, not eight.
  expect(() =>
    runScript(
      ell('--width 4m --depth 5m').doc,
      'add-object --room pokoj --type rug --width 3m --depth 1m',
    ),
  ).toThrow(/does not fit/)
})

test('the same thing tucked into the wide part of that L is allowed', () => {
  const next = runScript(
    ell('--width 4m --depth 3m').doc,
    'add-object --room pokoj --type rug-small --width 1.2m --depth 0.6m',
  )

  expect(things(next)).toHaveLength(1)
})

test('what the command checks is where the drawing will put it', () => {
  const doc = runScript(room().doc, 'add-object --room pokoj --type bedside --against north')
  const placed = things(doc)[0]!
  const level = Object.keys(doc.levels)[0]!
  const found = roomsOf(doc, level).find((entry) => entry.id === placed.room)!

  const spot = standingAt(doc, level, found, placed)!
  expect(fitsInside(doc, found, footprintOf(spot, placed))).toBe(true)
})
test('a spot that does not fit is passed over for the next one along', () => {
  // Two rugs already down leaves gaps either side; the third has to pick one.
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type rug --width 1.4m --depth 1m',
      'add-object --room pokoj --type rug --width 1.4m --depth 1m',
      'add-object --room pokoj --type rug --width 1.2m --depth 1m',
    ].join('\n'),
  )
  const along = things(next).map((thing) => thing.along)

  expect(things(next)).toHaveLength(3)
  expect(new Set(along).size).toBe(3)
})

test('a television stands on its console rather than beside it', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type tv-stand --against north',
      'add-object --room pokoj --type tv --against north',
    ].join('\n'),
  )
  const [stand, tv] = things(next)

  expect(tv!.against).toBe('north')
  expect(tv!.along).toBe(stand!.along)
})

test('two televisions on one wall still move over for one another', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type tv --against north',
      'add-object --room pokoj --type tv --against north',
    ].join('\n'),
  )
  const [one, other] = things(next)

  expect(Math.abs(one!.along - other!.along) * 6000).toBeGreaterThanOrEqual(1250)
})

test('a toilet roll lands beside the toilet, not on top of it', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type toilet --against north',
      'add-object --room pokoj --type toilet-roll --against north',
    ].join('\n'),
  )
  const [toilet, roll] = things(next)

  expect(roll!.against).toBe('north')
  expect(Math.abs(roll!.along - toilet!.along) * 6000).toBeGreaterThanOrEqual(
    (toilet!.width + roll!.width) / 2,
  )
})

test('kitchen units stand shoulder to shoulder, not spread along the wall', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type cabinet --against north --width 1.2m',
      'add-object --room pokoj --type cabinet --against north --width 1.2m',
    ].join('\n'),
  )
  const [first, second] = things(next)
  // Six metres between the corners, less half of each wall turning them: what a
  // thing is spread along is the clear stretch, not the centre lines.
  const apart = Math.abs(first!.along - second!.along) * (6000 - 300)

  // Touching, give or take nothing: a gap in the middle of a kitchen run is not
  // how a kitchen is built.
  expect(apart).toBeCloseTo((first!.width + second!.width) / 2, 0)
})

test('a sofa still spreads out, because a room is not a kitchen', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type sofa --against north --width 1.4m',
      'add-object --room pokoj --type sofa --against north --width 1.4m',
    ].join('\n'),
  )
  const [first, second] = things(next)

  expect(Math.abs(first!.along - second!.along) * 6000).toBeGreaterThan(1400)
})

test('the room a thing needs is in front of it, never behind the wall it stands at', () => {
  const doc = runScript(
    createEmptyDocument(),
    'floor-shape --material oak --kind rectangle --width 4m --depth 1.6m --name jídelna',
  )

  // A dining table is 900 deep and wants 440 round it for the chairs. Counting
  // that 440 behind it as well puts the table through the wall, and the room it
  // is standing in is plenty deep enough for a table with chairs down one side.
  const next = runScript(doc, 'add-object --room jídelna --type table --against north')

  expect(Object.values(next.objects)).toHaveLength(1)
})

test('two things at walls that meet do not end up in the same corner', () => {
  const doc = runScript(
    createEmptyDocument(),
    'floor-shape --material oak --kind rectangle --width 3m --depth 2.4m --name obývák',
  )

  const next = runScript(
    doc,
    [
      // The sofa is deep enough to reach past the middle of the room, so an
      // armchair put in the middle of the west wall would be sitting in it.
      'add-object --room obývák --type sofa --against north --width 2.6m',
      'add-object --room obývák --type armchair --against west',
    ].join('\n'),
  )
  const chair = Object.values(next.objects).find((thing) => thing.type === 'armchair')

  expect(chair).toBeDefined()
  // Keeping clear of what stands on your own wall was never the whole job: a wall
  // has two ends and each of them is a corner it shares with the wall round it.
  expect(Math.abs(chair!.along - 0.5)).toBeGreaterThan(0.2)
})

test('a thing can be turned, and it is checked on the shape it makes once turned', () => {
  const room = (depth: string, name: string) =>
    runScript(
      createEmptyDocument(),
      `floor-shape --material oak --kind rectangle --width 4m --depth ${depth} --name ${name}`,
    )

  const turned = runScript(
    room('4m', 'pokoj'),
    'add-object --room pokoj --type armchair --against west --turn 45',
  )
  expect(Object.values(turned.objects)[0]!.turn).toBe(45)

  // On the diagonal an armchair reaches a good deal further into the room than
  // the 850 it was cut to. A wall it stands at square on is not a wall it stands
  // at turned, and checking it on its unturned size puts half of it in the wall.
  const narrow = room('1.5m', 'chodba')
  expect(() =>
    runScript(narrow, 'add-object --room chodba --type armchair --against north'),
  ).not.toThrow()
  expect(() =>
    runScript(narrow, 'add-object --room chodba --type armchair --against north --turn 45'),
  ).toThrow(/does not fit/)
})
