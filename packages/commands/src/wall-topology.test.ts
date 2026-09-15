import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { wallHosts } from '@houseit/core/wall-hosts'
import { roomsOf } from '@houseit/geometry/rooms'
import { wallElement } from '@houseit/geometry/wall-elements'
import { expect, test } from 'vitest'
import { runScript } from './run'

const add = (x1: number, y1: number, x2: number, y2: number, thickness = 300) =>
  `add-wall --from '{"x":${x1},"y":${y1}}' --to '{"x":${x2},"y":${y2}}' --thickness ${thickness}`
const points = (doc: HouseDocument, id: string) => {
  const wall = doc.walls[id]!
  return [doc.nodes[wall.a]!, doc.nodes[wall.b]!] as const
}
const hosts = (doc: HouseDocument) =>
  [...Object.values(doc.openings), ...wallHosts(doc).map(({ host }) => host)].map((host) => {
    const [a, b] = points(doc, host.wall)
    return { x: a.x + (b.x - a.x) * host.t, y: a.y + (b.y - a.y) * host.t }
  })
const orthogonal = (doc: HouseDocument) => {
  for (const id of Object.keys(doc.walls)) {
    const [a, b] = points(doc, id)
    expect(a.x === b.x || a.y === b.y, `Diagonal wall ${id}`).toBe(true)
    expect(() => wallElement(doc, id)).not.toThrow()
  }
  expect(roomsOf(doc, Object.keys(doc.levels)[0]!)).toHaveLength(3)
  expect(Object.values(doc.rooms).map((r) => r.name)).toEqual(['Living', 'Hall', 'Study'])
}
function house(reverse = false) {
  const doc = runScript(
    createEmptyDocument(),
    [
      add(0, 0, 12000, 0),
      add(12000, 0, 12000, 8151),
      add(12000, 8151, 6500, 8151),
      add(6500, 8000, 5000, 8000),
      add(5000, 8151, 0, 8151),
      add(0, 8151, 0, 0),
      reverse ? add(5000, 8151, 5000, 0, 150) : add(5000, 0, 5000, 8151, 150),
      reverse ? add(6500, 8151, 6500, 0, 150) : add(6500, 0, 6500, 8151, 150),
      `add-room --at '{"x":2500,"y":4000}' --name Living --material natural-oak`,
      `add-room --at '{"x":5750,"y":4000}' --name Hall --material natural-oak`,
      `add-room --at '{"x":9000,"y":4000}' --name Study --material natural-oak`,
    ].join('\n'),
  )
  const spine = Object.values(doc.walls).find((w) => points(doc, w.id).every((p) => p.x === 5000))!
  return runScript(
    doc,
    `add-opening --wall ${spine.element} --kind door --width 900 --along ${reverse ? 6151 : 2000}\nadd-device --wall ${spine.element} --kind socket --height 350 --along ${reverse ? 4651 : 3500}`,
  )
}
const north = (doc: HouseDocument, name: string) =>
  Object.values(doc.rooms)
    .find((r) => r.name === name)!
    .loop.find((id) => points(doc, id).every((p) => p.y === (name === 'Hall' ? 8000 : 8151)))!

for (const reverse of [false, true]) {
  test.each(['room', 'wall'])(
    `a %s pull removes an empty end segment of a longer wall (reverse=${reverse})`,
    (kind) => {
      const doc = house(reverse),
        id = north(doc, 'Living'),
        hall = north(doc, 'Hall')
      const source =
        kind === 'room'
          ? `update-room --room Living --wall ${id} --by -151`
          : `update-wall --id ${id} --by 151`
      const next = runScript(doc, source)
      expect(points(next, id).map((p) => p.y)).toEqual([8000, 8000])
      expect(points(next, hall)).toEqual(points(doc, hall))
      expect(hosts(next)).toEqual(hosts(doc))
      expect(Object.keys(next.walls)).toHaveLength(Object.keys(doc.walls).length - 1)
      orthogonal(next)
    },
  )
}

test('one corridor pull reconnects both split walls and rehosts a device where the wall remains', () => {
  const initial = house(),
    id = north(initial, 'Hall')
  const spine = Object.values(initial.walls).find((w) =>
    points(initial, w.id).every((p) => p.x === 5000),
  )!
  const doc = runScript(
    initial,
    `add-device --wall ${spine.element} --kind socket --height 350 --along 8075`,
  )
  const beforeHosts = hosts(doc)
  const next = runScript(doc, `update-room --room Hall --wall ${id} --by 151`)
  for (const name of ['Living', 'Hall', 'Study'])
    expect(points(next, north(doc, name)).map((p) => p.y)).toEqual([8151, 8151])
  expect(Object.keys(next.walls)).toHaveLength(Object.keys(doc.walls).length - 2)
  expect(hosts(next)).toEqual(beforeHosts)
  expect(Object.keys(next.devices)).toEqual(Object.keys(doc.devices))
  orthogonal(next)
})

test('a pull passes a split-wall junction and repeated alignment preserves hosts and neighbouring rooms', () => {
  const doc = house(),
    id = north(doc, 'Living'),
    hall = north(doc, 'Hall'),
    study = north(doc, 'Study')
  let next = runScript(doc, `update-wall --id ${id} --by 1151`)
  expect(points(next, id).map((p) => p.y)).toEqual([7000, 7000])
  for (let i = 0; i < 3; i++) {
    for (const by of [-1000, -1000, 1000, 1000]) {
      next = runScript(next, `update-wall --id ${id} --by ${by}`)
      expect(hosts(next)).toEqual(hosts(doc))
      expect(points(next, hall)).toEqual(points(doc, hall))
      expect(points(next, study)).toEqual(points(doc, study))
      orthogonal(next)
    }
  }
  expect(points(next, id).map((p) => p.y)).toEqual([7000, 7000])
})

test('removing physical support still refuses the complete multi-edge transaction', () => {
  const initial = house(),
    id = north(initial, 'Living')
  const spine = Object.values(initial.walls).find((w) =>
    points(initial, w.id).every((p) => p.x === 5000),
  )!
  const doc = runScript(
    initial,
    `add-device --wall ${spine.element} --kind socket --height 350 --along 8075`,
  )
  const before = JSON.stringify(doc)
  expect(() => runScript(doc, `update-wall --id ${id} --by 151`)).toThrow(/host|fits/)
  expect(JSON.stringify(doc)).toBe(before)
})
