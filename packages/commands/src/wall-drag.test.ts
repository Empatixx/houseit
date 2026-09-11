import { createEmptyDocument, type HouseDocument, parseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { runOfWall, sideOfWall } from '@houseit/geometry/sides'
import { expect, test } from 'vitest'
import { runScript } from './run'

const PLAN = [
  'add-room --material natural-oak --shape rectangle --width 9m --depth 7m --name dům',
  'add-room --material tile-white --from dům --name kuchyň --side north --depth 2.5m',
  'add-room --material concrete-light --from dům --name hala --side west --width 2m',
  'add-room --material tile-slate --from dům --name wc --side south --depth 2m',
].join('\n')

const SHORTEST = 300

const house = () => runScript(createEmptyDocument(), PLAN)
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const FAR = [100, 300, 1000, 2000, 3000, 5000].flatMap((by) => [by, -by])

const every = (doc: HouseDocument, distances: number[] = [300, -300]) =>
  Object.values(doc.rooms).flatMap((room) =>
    room.loop.flatMap((wall) => distances.map((by) => ({ room: room.name, wall, by }))),
  )
const lengthOf = (doc: HouseDocument, wall: { a: string; b: string }) =>
  Math.hypot(
    doc.nodes[wall.b]!.x - doc.nodes[wall.a]!.x,
    doc.nodes[wall.b]!.y - doc.nodes[wall.a]!.y,
  )

test('every wall of every room can be moved either way and the plan stays whole', () => {
  const start = house()
  const broken: string[] = []

  for (const { room, wall, by } of every(start, FAR)) {
    const where = `${room} ${wall} ${by}`
    let doc: HouseDocument
    try {
      doc = runScript(start, `update-room --room "${room}" --wall ${wall} --by ${by}`)
    } catch (error) {
      const said = error instanceof Error ? error.message : String(error)
      if (!said.startsWith('move-wall:')) broken.push(`${where}: ${said}`)
      continue
    }
    try {
      parseDocument(doc)
    } catch (error) {
      broken.push(`${where}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const rooms = roomsOf(doc, level(start))
    if (rooms.length !== 4) broken.push(`${where}: ${rooms.length} rooms, not 4`)
    if (rooms.some((face) => face.name === undefined)) broken.push(`${where}: a room lost its name`)
    const stub = Object.values(doc.walls).find((it) => lengthOf(doc, it) < SHORTEST)
    if (stub)
      broken.push(`${where}: left ${stub.id} only ${Math.round(lengthOf(doc, stub))} mm long`)
  }

  expect(broken).toEqual([])
})

test('a wall moved on its own goes exactly as far as it was asked to', () => {
  const start = house()
  const short: string[] = []

  for (const { room, wall, by } of every(start)) {
    const doc = runScript(start, `update-room --room "${room}" --wall ${wall} --by ${by}`)
    const was = start.walls[wall]!
    const now = doc.walls[wall]!
    const went = Math.round(
      Math.hypot(
        doc.nodes[now.a]!.x - start.nodes[was.a]!.x,
        doc.nodes[now.a]!.y - start.nodes[was.a]!.y,
      ),
    )
    if (went !== 300) short.push(`${room} ${wall} ${by}: went ${went}`)
  }

  expect(short).toEqual([])
})

test('the side the plan reads off a wall is the side the command moves', () => {
  const doc = house()
  const disagreed: string[] = []

  for (const room of roomsOf(doc, level(doc))) {
    if (!room.name) continue
    for (const id of Object.keys(doc.walls)) {
      const byFace = sideOfWall(doc, level(doc), room, id)
      const byRun = runOfWall(doc, level(doc), room, id)?.side
      if (byFace === undefined && byRun === undefined) continue
      if (byFace !== byRun) disagreed.push(`${room.name} ${id}: ${byFace} vs ${byRun}`)
    }
  }

  expect(disagreed).toEqual([])
})

test('a nudge too small to build a step out of is refused rather than built', () => {
  const start = house()
  const wall = Object.values(start.rooms)
    .find((room) => room.name === 'kuchyň')!
    .loop.find((id) => {
      const it = start.walls[id]!
      const a = start.nodes[it.a]!
      const b = start.nodes[it.b]!
      return a.y === 4500 && b.y === 4500 && Math.min(a.x, b.x) === 2000
    })!

  expect(() => runScript(start, `update-room --room kuchyň --wall ${wall} --by 100`)).toThrow(
    /less than the 300 mm a wall has to be/,
  )
})

test('a move that would flatten the room beyond it is refused', () => {
  const start = house()
  const between = Object.values(start.rooms)
    .find((room) => room.name === 'wc')!
    .loop.find((id) => {
      const wall = start.walls[id]!
      return start.nodes[wall.a]!.y === 2000 && start.nodes[wall.b]!.y === 2000
    })!

  expect(() => runScript(start, `update-room --room wc --wall ${between} --by -2000`)).toThrow(
    /squash the room beyond it flat/,
  )
})
