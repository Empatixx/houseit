import { runScript } from '@houseit/commands/run'
import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { swingOf } from '@houseit/geometry/swing'
import { expect, test } from 'vitest'
import { DOLLY, type Shot, shotsOf, tourOf, turnBetween } from './shots'

const FOV = 90

const house = (...lines: string[]) => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --material natural-oak --shape rectangle --width 5m --depth 4m --name bedroom',
      ...lines,
    ].join('\n'),
  )
  return { doc, level: Object.keys(doc.levels)[0]! }
}

const roomNamed = (doc: HouseDocument, level: string, name: string) =>
  roomsOf(doc, level).find((room) => room.name === name)!

const centreOf = (doc: HouseDocument, level: string, type: string) => {
  const object = Object.values(doc.objects).find((candidate) => candidate.type === type)!
  const room = roomsOf(doc, level).find((candidate) => candidate.id === object.room)!
  const corners = piecesOf(standingAt(doc, level, room, object)!, object).flat()
  return {
    x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
    y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
  }
}

const sees = (shot: Shot, at: { x: number; y: number }) =>
  Math.abs(turnBetween(Math.atan2(at.x - shot.at.x, at.y - shot.at.y), shot.yaw)) <
  (FOV * Math.PI) / 360

test('a bedroom is shot with its bed in the picture', () => {
  const { doc, level } = house('add-object --room bedroom --type queen-bed --against north')

  const [shot] = shotsOf(doc, level, roomNamed(doc, level, 'bedroom'), FOV)

  expect(shot).toBeDefined()
  expect(sees(shot!, centreOf(doc, level, 'queen-bed'))).toBe(true)
})

test('the camera stands back from what it shoots rather than on top of it', () => {
  const { doc, level } = house('add-object --room bedroom --type queen-bed --against north')

  const [shot] = shotsOf(doc, level, roomNamed(doc, level, 'bedroom'), FOV)
  const bed = centreOf(doc, level, 'queen-bed')

  expect(Math.hypot(shot!.at.x - bed.x, shot!.at.y - bed.y)).toBeGreaterThan(1800)
})

test('an empty room is shot along its length, not into the nearest wall', () => {
  const { doc, level } = house()

  const [shot] = shotsOf(doc, level, roomNamed(doc, level, 'bedroom'), FOV)
  const ahead = { x: Math.sin(shot!.yaw), y: Math.cos(shot!.yaw) }

  expect(Math.abs(ahead.x)).toBeGreaterThan(Math.abs(ahead.y) - 0.2)
})

test('a wardrobe in the picture stands at least its own height away', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --material natural-oak --shape rectangle --width 4m --depth 3.6m --name bedroom',
      'add-object --room bedroom --type queen-bed --against north',
      'add-object --room bedroom --type wardrobe --against south --along 0.2',
    ].join('\n'),
  )
  const level = Object.keys(doc.levels)[0]!
  const wardrobe = Object.values(doc.objects).find((object) => object.type === 'wardrobe')!
  const room = roomNamed(doc, level, 'bedroom')
  const corners = piecesOf(standingAt(doc, level, room, wardrobe)!, wardrobe).flat()
  const tall = heightOf('wardrobe').height

  for (const shot of shotsOf(doc, level, room, FOV)) {
    const ahead = {
      x: shot.at.x + Math.sin(shot.yaw) * DOLLY,
      y: shot.at.y + Math.cos(shot.yaw) * DOLLY,
    }
    const close = corners.filter(
      (corner) => sees(shot, corner) && Math.hypot(corner.x - ahead.x, corner.y - ahead.y) < tall,
    )
    expect(close).toEqual([])
  }
})

test('the open door leaf is kept out of the foreground', () => {
  const { doc, level } = house(
    'add-object --room bedroom --type queen-bed --against north',
    'add-opening --kind door --room bedroom --side south',
  )

  const [shot] = shotsOf(doc, level, roomNamed(doc, level, 'bedroom'), FOV)
  const door = Object.values(doc.openings).find((opening) => opening.kind === 'door')!
  const swing = swingOf(doc, door)!
  const inside =
    shot!.at.x > swing.x0 && shot!.at.x < swing.x1 && shot!.at.y > swing.y0 && shot!.at.y < swing.y1

  expect(inside).toBe(false)
})

test('a tour visits every room once, starting at the way in', () => {
  const { doc } = house(
    'add-room --material natural-oak --name hall --from bedroom --side west --width 1.6m',
    'add-opening --kind door --room hall --side south',
    'add-opening --kind door --room hall --side east',
  )

  const tour = tourOf(doc, FOV)
  const rooms = tour.map((shot) => shot.name)

  expect(new Set(rooms)).toEqual(new Set(['hall', 'bedroom']))
  expect(rooms[0]).toBe('hall')
})

test('a large room gets a second shot from somewhere else', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --material natural-oak --shape rectangle --width 8m --depth 6m --name living',
      'add-object --room living --type sofa-3 --against south',
      'add-object --room living --type dining-6 --along 0.25',
      'add-object --room living --type bookshelf --against north',
    ].join('\n'),
  )
  const level = Object.keys(doc.levels)[0]!

  const shots = shotsOf(doc, level, roomNamed(doc, level, 'living'), FOV)

  expect(shots).toHaveLength(2)
  expect(
    Math.hypot(shots[0]!.at.x - shots[1]!.at.x, shots[0]!.at.y - shots[1]!.at.y),
  ).toBeGreaterThan(2000)
})

test('nothing to shoot in a house with no rooms', () => {
  expect(tourOf(createEmptyDocument(), FOV)).toEqual([])
})
