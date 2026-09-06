import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { fitsInside } from '@houseit/geometry/fits'
import { roomsOf } from '@houseit/geometry/rooms'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { expect, test } from 'vitest'
import { runScript } from './run'

const room = () => ({
  doc: runScript(
    createEmptyDocument(),
    'add-room --material natural-oak --shape rectangle --width 6m --depth 4m --name pokoj',
  ),
})
const things = (doc: HouseDocument) => Object.values(doc.objects)

test('something put in a room belongs to that room, at its own size', () => {
  const next = runScript(room().doc, 'add-object --room pokoj --type dining-6')

  expect(things(next)).toEqual([
    expect.objectContaining({ type: 'dining-6', width: 1600, depth: 2210, surface: 'oak' }),
  ])
})

test('a second thing lands beside the first, not inside it', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type office-chair',
      'add-object --room pokoj --type office-chair',
    ].join('\n'),
  )
  const [first, second] = things(next)

  expect(Math.abs(first!.along - second!.along) * 6000).toBeGreaterThanOrEqual(711)
})

test('size, surface and places can all be given', () => {
  const next = runScript(
    room().doc,
    'add-object --room pokoj --type dining-6 --surface marble --width 2.4m --depth 1.1m --seats 8',
  )

  expect(things(next)).toEqual([
    expect.objectContaining({ surface: 'marble', width: 2400, depth: 1100, seats: 8 }),
  ])
})

test('a surface the thing never comes in is refused, and says what it does come in', () => {
  expect(() =>
    runScript(room().doc, 'add-object --room pokoj --type office-chair --surface glass'),
  ).toThrow(/fabric/)
})

test('a thing too big for the room is refused', () => {
  expect(() => runScript(room().doc, 'add-object --room pokoj --type dining-6 --width 9m')).toThrow(
    /does not fit/,
  )
})

test('putting something in a room that does not exist says so', () => {
  expect(() => runScript(room().doc, 'add-object --room garáž --type office-chair')).toThrow(
    /garáž/,
  )
})

test('a rug goes in the middle and is in nobody way', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type rug-rect --surface blue',
      'add-object --room pokoj --type dining-6',
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
      'add-object --room pokoj --type rug-rect --surface blue --width 1.5m --depth 1m',
      'add-object --room pokoj --type rug-rect --surface rust --width 1.5m --depth 1m',
    ].join('\n'),
  )
  const [one, other] = things(next)

  expect(Math.abs(one!.along - other!.along) * 6000).toBeGreaterThanOrEqual(1500)
})

const ell = (bite: string) => ({
  doc: runScript(
    createEmptyDocument(),
    [
      'add-room --material natural-oak --shape rectangle --width 8m --depth 6m --name pokoj',
      `add-room --material natural-oak --name kout --from pokoj --corner north-east ${bite}`,
    ].join('\n'),
  ),
})

test('a thing too big to fit inside the room is refused, not left hanging out of it', () => {
  expect(() =>
    runScript(room().doc, 'add-object --room pokoj --type rug-rect --width 5m --depth 4.5m'),
  ).toThrow(/does not fit/)
})

test('a thing that would lie across the waist of an L moves to the wide part instead', () => {
  const next = runScript(
    ell('--width 4m --depth 5m').doc,
    'add-object --room pokoj --type rug-rect --width 3m --depth 1m',
  )
  const placed = things(next)!

  expect(placed).toHaveLength(1)
  expect(placed[0]!.along).not.toBe(0.5)
})

test('a thing wider than any part of an L is refused', () => {
  expect(() =>
    runScript(
      ell('--width 4m --depth 5m').doc,
      'add-object --room pokoj --type rug-rect --width 7.9m --depth 1m',
    ),
  ).toThrow(/does not fit/)
})

test('the same thing tucked into the wide part of that L is allowed', () => {
  const next = runScript(
    ell('--width 4m --depth 3m').doc,
    'add-object --room pokoj --type rug-round --width 1.2m --depth 0.6m',
  )

  expect(things(next)).toHaveLength(1)
})

test('what the command checks is where the drawing will put it', () => {
  const doc = runScript(room().doc, 'add-object --room pokoj --type nightstand --against north')
  const placed = things(doc)[0]!
  const level = Object.keys(doc.levels)[0]!
  const found = roomsOf(doc, level).find((entry) => entry.id === placed.room)!

  const spot = standingAt(doc, level, found, placed)!
  expect(fitsInside(doc, found, footprintOf(spot, placed))).toBe(true)
})
test('a spot that does not fit is passed over for the next one along', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type rug-rect --width 1.4m --depth 1m',
      'add-object --room pokoj --type rug-rect --width 1.4m --depth 1m',
      'add-object --room pokoj --type rug-rect --width 1.2m --depth 1m',
    ].join('\n'),
  )
  const along = things(next).map((thing) => thing.along)

  expect(things(next)).toHaveLength(3)
  expect(new Set(along).size).toBe(3)
})

test('a lamp stands on the table under it rather than beside it', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type nightstand --against north',
      'add-object --room pokoj --type table-lamp --against north',
    ].join('\n'),
  )
  const [stand, lamp] = things(next)

  expect(lamp!.against).toBe('north')
  expect(lamp!.along).toBe(stand!.along)
})

test('two lamps on one wall still move over for one another', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type table-lamp --against north',
      'add-object --room pokoj --type table-lamp --against north',
    ].join('\n'),
  )
  const [one, other] = things(next)

  expect(Math.abs(one!.along - other!.along) * 6000).toBeGreaterThanOrEqual(356)
})

test('a basin lands beside the toilet, not on top of it', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type toilet-tank --against north',
      'add-object --room pokoj --type vanity-sink --against north',
    ].join('\n'),
  )
  const [toilet, basin] = things(next)

  expect(basin!.against).toBe('north')
  expect(Math.abs(basin!.along - toilet!.along) * 6000).toBeGreaterThanOrEqual(
    (toilet!.width + basin!.width) / 2,
  )
})

test('kitchen units stand shoulder to shoulder, not spread along the wall', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type counter-straight --against north --width 1.2m',
      'add-object --room pokoj --type counter-straight --against north --width 1.2m',
    ].join('\n'),
  )
  const [first, second] = things(next)
  const apart = Math.abs(first!.along - second!.along) * (6000 - 300)

  expect(apart).toBeCloseTo((first!.width + second!.width) / 2, 0)
})

test('a sofa still spreads out, because a room is not a kitchen', () => {
  const next = runScript(
    room().doc,
    [
      'add-object --room pokoj --type sofa-2 --against north --width 1.4m',
      'add-object --room pokoj --type sofa-2 --against north --width 1.4m',
    ].join('\n'),
  )
  const [first, second] = things(next)

  expect(Math.abs(first!.along - second!.along) * 6000).toBeGreaterThan(1400)
})

test('two things at walls that meet do not end up in the same corner', () => {
  const doc = runScript(
    createEmptyDocument(),
    'add-room --material natural-oak --shape rectangle --width 3m --depth 2.4m --name obývák',
  )

  const next = runScript(
    doc,
    [
      'add-object --room obývák --type sofa-3 --against north --width 2.6m',
      'add-object --room obývák --type club-chair --against west',
    ].join('\n'),
  )
  const chair = Object.values(next.objects).find((thing) => thing.type === 'club-chair')

  expect(chair).toBeDefined()
  expect(Math.abs(chair!.along - 0.5)).toBeGreaterThan(0.2)
})

test('a thing can be turned, and it is checked on the shape it makes once turned', () => {
  const room = (depth: string, name: string) =>
    runScript(
      createEmptyDocument(),
      `add-room --material natural-oak --shape rectangle --width 4m --depth ${depth} --name ${name}`,
    )

  const turned = runScript(
    room('4m', 'pokoj'),
    'add-object --room pokoj --type club-chair --against west --rotation 45',
  )
  expect(Object.values(turned.objects)[0]!.rotation).toBe(45)

  const narrow = room('1.5m', 'chodba')
  expect(() =>
    runScript(narrow, 'add-object --room chodba --type club-chair --against north'),
  ).not.toThrow()
  expect(() =>
    runScript(narrow, 'add-object --room chodba --type club-chair --against north --rotation 45'),
  ).toThrow(/does not fit/)
})
