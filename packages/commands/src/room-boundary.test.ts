import { createEmptyDocument, type HouseDocument, parseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { standingAt } from '@houseit/geometry/standing'
import { elementId, wallElement } from '@houseit/geometry/wall-elements'
import { expect, test } from 'vitest'
import { runScript } from './run'

const house = () =>
  runScript(
    createEmptyDocument(),
    [
      'add-room --shape rectangle --width 10m --depth 8m --name Lower --material natural-oak',
      'add-room --from Lower --side north --depth 4m --name Upper --material natural-oak',
      'add-room --from Upper --side east --width 5m --name Right --material natural-oak',
      'add-opening --room Lower --side north --kind door --along 0.2 --width 900',
      'add-opening --room Right --side north --kind window --width 1500',
      'add-object --room Lower --type coffee-table --along 0.5 --across 0.5',
    ].join('\n'),
  )
const points = (doc: HouseDocument, wall: string) => [
  doc.nodes[doc.walls[wall]!.a]!,
  doc.nodes[doc.walls[wall]!.b]!,
]
const boundary = (doc: HouseDocument, name: string, y: number) =>
  Object.values(doc.rooms)
    .find((r) => r.name === name)!
    .loop.find(
      (id) => points(doc, id).every((p) => p.y === y) && points(doc, id).some((p) => p.x === 0),
    )!
const area = (doc: HouseDocument, name: string) =>
  roomsOf(doc, Object.keys(doc.levels)[0]!).find((r) => r.name === name)!.area
const openingPosition = (doc: HouseDocument, id: string) => {
  const o = doc.openings[id]!,
    [a, b] = points(doc, o.wall)
  return { x: a!.x + (b!.x - a!.x) * o.t, y: a!.y + (b!.y - a!.y) * o.t }
}

test('pulling one part of a room boundary makes an L and leaves the other two-room boundary fixed', () => {
  const doc = house(),
    id = boundary(doc, 'Lower', 4000)
  const still = Object.values(doc.walls).filter(
    (wall) => wall.id !== id && points(doc, wall.id).every((p) => p.y === 4000),
  )
  const next = runScript(doc, `update-room --room Lower --wall ${id} --by 500`)
  expect(points(next, id).map((p) => p.y)).toEqual([4500, 4500])
  for (const wall of still) expect(points(next, wall.id)).toEqual(points(doc, wall.id))
  expect(area(next, 'Lower') - area(doc, 'Lower')).toBe(2_500_000)
  expect(area(doc, 'Upper') - area(next, 'Upper')).toBe(2_500_000)
  expect(area(next, 'Right')).toBe(area(doc, 'Right'))
  expect(Object.values(next.rooms).find((r) => r.name === 'Lower')!.loop.length).toBeGreaterThan(4)
  expect(openingPosition(next, 'o1')).toEqual({ ...openingPosition(doc, 'o1'), y: 4500 })
  expect(openingPosition(next, 'o2')).toEqual(openingPosition(doc, 'o2'))
  const furniture = (doc: HouseDocument) =>
    standingAt(
      doc,
      Object.keys(doc.levels)[0]!,
      roomsOf(doc, Object.keys(doc.levels)[0]!).find((r) => r.name === 'Lower')!,
      doc.objects.f1!,
    )!.at
  expect(furniture(next)).toEqual(furniture(doc))
  for (const wall of Object.values(next.walls))
    expect(() => wallElement(next, wall.id)).not.toThrow()
  expect(parseDocument(next)).toEqual(next)
})

test.each([500, -500])('an outer room handle moves only its boundary by %i mm', (by) => {
  const doc = house(),
    id = boundary(doc, 'Upper', 8000)
  const unchanged = Object.values(doc.walls).find(
    (w) => w.id !== id && points(doc, w.id).every((p) => p.y === 8000),
  )!
  const next = runScript(doc, `update-room --room Upper --wall ${id} --by ${by}`)
  expect(points(next, id).map((p) => p.y)).toEqual([8000 + by, 8000 + by])
  expect(points(next, unchanged.id)).toEqual(points(doc, unchanged.id))
  expect(area(next, 'Right')).toBe(area(doc, 'Right'))
  expect(area(next, 'Lower')).toBe(area(doc, 'Lower'))
  expect(openingPosition(next, 'o2')).toEqual(openingPosition(doc, 'o2'))
  expect(elementId(next.walls[id]!)).not.toBe(elementId(next.walls[unchanged.id]!))
})

test('whole-wall editing still moves all its segments', () => {
  const doc = house(),
    id = boundary(doc, 'Upper', 8000)
  const next = runScript(doc, `update-wall --id ${elementId(doc.walls[id]!)} --by -500`)
  expect(
    Object.values(doc.walls)
      .filter((w) => points(doc, w.id).every((p) => p.y === 8000))
      .every((w) => points(next, w.id).every((p) => p.y === 8500)),
  ).toBe(true)
})

test('an independent wall pulled after alignment leaves the neighbouring room rectangular', () => {
  const initial = house(),
    id = boundary(initial, 'Upper', 8000)
  const doc = runScript(
    initial,
    `update-room --room Upper --wall ${id} --by 151\nupdate-room --room Upper --wall ${id} --by -151`,
  )
  const neighbour = Object.values(doc.walls).find(
    (w) => w.id !== id && points(doc, w.id).every((p) => p.y === 8000),
  )!
  const next = runScript(doc, `update-wall --id ${id} --by -4009`)
  expect(points(next, id).map((p) => p.y)).toEqual([12009, 12009])
  expect(points(next, neighbour.id)).toEqual(points(doc, neighbour.id))
  expect(area(next, 'Right')).toBe(area(doc, 'Right'))
  expect(openingPosition(next, 'o2')).toEqual(openingPosition(doc, 'o2'))
  expect(Object.keys(next.rooms)).toEqual(Object.keys(doc.rooms))
  for (const wall of Object.values(next.walls)) {
    const [a, b] = points(next, wall.id)
    expect(a!.x === b!.x || a!.y === b!.y).toBe(true)
  }
  const aligned = runScript(next, `update-wall --id ${id} --by 4009`)
  expect(points(aligned, id)).toEqual(points(doc, id))
  expect(area(aligned, 'Right')).toBe(area(doc, 'Right'))
})

test('a split independent element moves all its segments without tilting an aligned continuation', () => {
  const initial = house(),
    id = boundary(initial, 'Upper', 8000)
  const right = Object.values(initial.rooms)
    .find((room) => room.name === 'Right')!
    .loop.find((id) => points(initial, id).every((p) => p.y === 8000))!
  const detached = runScript(initial, `update-room --room Right --wall ${right} --by 500`)
  const doc = runScript(
    detached,
    `update-room --room Right --wall ${right} --by -500\nadd-wall --from '{"x":2500,"y":6000}' --to '{"x":2500,"y":8000}' --thickness 150`,
  )
  const element = wallElement(doc, id)
  expect(element.segments.length).toBeGreaterThan(1)
  const next = runScript(doc, `update-wall --id ${element.id} --by -1000`)
  for (const segment of element.segments)
    expect(points(next, segment.wall.id).map((p) => p.y)).toEqual([9000, 9000])
  expect(area(next, 'Right')).toBe(area(doc, 'Right'))
  expect(openingPosition(next, 'o2')).toEqual(openingPosition(doc, 'o2'))
  for (const wall of Object.values(next.walls)) {
    const [a, b] = points(next, wall.id)
    expect(a!.x === b!.x || a!.y === b!.y).toBe(true)
  }
})

test('electrical hosts follow only the moved room boundary and prevent removal of an occupied return', () => {
  const initial = house(),
    id = boundary(initial, 'Lower', 4000)
  const doc = runScript(initial, `add-device --kind socket --wall ${id} --along 3500 --height 350`)
  const next = runScript(doc, `update-room --room Lower --wall ${id} --by 500`)
  const device = Object.values(next.devices)[0]!
  if (device.host.kind !== 'wall') throw new Error('Expected a wall-mounted device')
  expect(device.host.wall).toBe(id)
  expect(points(next, device.host.wall).map((p) => p.y)).toEqual([4500, 4500])
  const step = Object.keys(next.walls).find((id) => !doc.walls[id])!
  const occupied = runScript(
    next,
    `add-device --kind socket --wall ${step} --along 250 --height 350`,
  )
  expect(() => runScript(occupied, `update-room --room Lower --wall ${id} --by -500`)).toThrow(
    /collapse/,
  )
  expect(points(occupied, id).map((p) => p.y)).toEqual([4500, 4500])
})

test('invalid local movement refuses the complete script including earlier changes', () => {
  const doc = house(),
    original = JSON.stringify(doc),
    id = boundary(doc, 'Lower', 4000)
  expect(() =>
    runScript(
      doc,
      `update-room --room Lower --name Changed\nupdate-room --room Changed --wall ${id} --by 5000`,
    ),
  ).toThrow(/move-wall/)
  expect(JSON.stringify(doc)).toBe(original)
})

test('a room can pass an intermediate return and align with a farther neighbouring roofline', () => {
  const initial = runScript(
    house(),
    'add-room --from Right --side east --width 3500 --name Study --material beech',
  )
  const upper = boundary(initial, 'Upper', 8000)
  const study = Object.values(initial.rooms)
    .find((room) => room.name === 'Study')!
    .loop.find((id) => points(initial, id).every((p) => p.y === 8000))!
  const doc = runScript(
    initial,
    `update-room --room Upper --wall ${upper} --by -410\nupdate-room --room Study --wall ${study} --by 853`,
  )
  const next = runScript(doc, `update-room --room Upper --wall ${upper} --by 1263`)
  expect(points(next, upper).map((p) => p.y)).toEqual([8853, 8853])
  expect(points(next, study)).toEqual(points(doc, study))
  expect(area(next, 'Right')).toBe(area(doc, 'Right'))
  expect(Object.keys(next.rooms)).toEqual(Object.keys(doc.rooms))
  const back = runScript(next, `update-room --room Upper --wall ${upper} --by -1263`)
  expect(points(back, upper).map((p) => p.y)).toEqual([7590, 7590])
  expect(area(back, 'Upper')).toBe(area(doc, 'Upper'))
})
