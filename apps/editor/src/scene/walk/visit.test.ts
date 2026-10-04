import { runScript } from '@houseit/commands/run'
import { createEmptyDocument } from '@houseit/core/document'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { expect, test } from 'vitest'
import { yawTowards } from '../../store/walk'
import { visitOf } from './visit'

const flat = () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --material natural-oak --shape rectangle --width 9m --depth 6m --name living',
      'add-room --name bedroom --from living --side east --width 3.4m --material white-oak',
      'add-object --room bedroom --type queen-bed --against north --surface blue',
      'add-opening --room bedroom --side west --kind door --width 900',
    ].join('\n'),
  )
  const level = Object.keys(doc.levels)[0]!
  const id = (name: string) => Object.values(doc.rooms).find((room) => room.name === name)!.id
  const outline = (name: string) =>
    roomsOf(doc, level)
      .find((room) => room.id === id(name))!
      .nodes.map((node) => doc.nodes[node]!)
  return { doc, level, id, outline }
}

test('choosing a room in the plan list stands you inside that room', () => {
  const { doc, level, id, outline } = flat()
  for (const name of ['living', 'bedroom']) {
    const start = visitOf(doc, level, { kind: 'room', id: id(name) })!
    expect(containsPoint(outline(name), start.at.x, start.at.y), name).toBe(true)
  }
})

test('choosing a thing stands you in its room, facing it', () => {
  const { doc, level, id, outline } = flat()
  const bed = Object.values(doc.objects)[0]!
  const start = visitOf(doc, level, { kind: 'object', id: bed.id })!
  expect(containsPoint(outline('bedroom'), start.at.x, start.at.y)).toBe(true)
  const room = roomsOf(doc, level).find((face) => face.id === id('bedroom'))!
  const corners = piecesOf(standingAt(doc, level, room, bed)!, bed).flat()
  const centre = {
    x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length,
    y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length,
  }
  expect(start.yaw).toBeCloseTo(yawTowards(start.at, centre), 6)
  const door = Object.values(doc.openings)[0]!
  const through = visitOf(doc, level, { kind: 'opening', id: door.id, room: id('bedroom') })!
  expect(containsPoint(outline('bedroom'), through.at.x, through.at.y)).toBe(true)
})
