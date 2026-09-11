import { openingWidth } from '@houseit/commands/add-opening'
import { applyCommand, runScript } from '@houseit/commands/run'
import { updateObject } from '@houseit/commands/update-object'
import { updateOpening } from '@houseit/commands/update-opening'
import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { dropOf } from '../scene/furniture/drop'
import { openingDropOf } from '../scene/opening-drop'

const PLAN = [
  'add-room --material natural-oak --shape rectangle --width 10m --depth 8m --name flat',
  'add-room --material beech --from flat --name bedroom --side north --depth 3m',
  'add-room --material beech --from flat --name pantry --side west --width 1.6m',
  'add-opening --kind window --room bedroom --side north --width 1500',
  'add-object --room flat --type sofa-3 --against south',
].join('\n')

const plan = () => runScript(createEmptyDocument(), PLAN)
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const roomNamed = (doc: HouseDocument, name: string) =>
  roomsOf(doc, level(doc)).find((room) => room.name === name)!

test('an opening dragged anywhere along a side lands where the command will take it', () => {
  const doc = plan()
  const room = roomNamed(doc, 'bedroom')
  const opening = Object.values(doc.openings)[0]!
  const xs = room.nodes.map((node) => doc.nodes[node]!.x)
  const ys = room.nodes.map((node) => doc.nodes[node]!.y)
  const refused: string[] = []

  for (let i = 0; i <= 40; i += 1) {
    const point = {
      x: Math.min(...xs) - 2000 + ((Math.max(...xs) - Math.min(...xs) + 4000) * i) / 40,
      y: Math.max(...ys),
    }
    const drop = openingDropOf(doc, level(doc), room, point, opening.width)
    if (!drop) continue
    try {
      applyCommand(doc, updateOpening, { id: opening.id, toSide: drop.toSide, along: drop.along })
    } catch (error) {
      refused.push(`${point.x}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  expect(refused).toEqual([])
})

test('a door dragged to the very end of a short side is not asked for where it cannot go', () => {
  const doc = plan()
  const room = roomNamed(doc, 'pantry')
  const ys = room.nodes.map((node) => doc.nodes[node]!.y)
  const refused: string[] = []

  for (let i = 0; i <= 20; i += 1) {
    const point = {
      x: Math.min(...room.nodes.map((node) => doc.nodes[node]!.x)),
      y: Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * i) / 20,
    }
    const drop = openingDropOf(doc, level(doc), room, point, openingWidth('door'))
    if (!drop) continue
    try {
      runScript(
        doc,
        `add-opening --kind door --room pantry --side ${drop.toSide} --along ${drop.along}`,
      )
    } catch (error) {
      refused.push(`${point.y}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  expect(refused).toEqual([])
})

test('a thing dragged fast to the far corner of a room is put down inside it', () => {
  const doc = plan()
  const room = roomNamed(doc, 'flat')
  const object = Object.values(doc.objects)[0]!
  const xs = room.nodes.map((node) => doc.nodes[node]!.x)
  const ys = room.nodes.map((node) => doc.nodes[node]!.y)
  const refused: string[] = []

  for (const x of [
    Math.min(...xs) - 3000,
    Math.min(...xs),
    5000,
    Math.max(...xs),
    Math.max(...xs) + 3000,
  ]) {
    for (const y of [
      Math.min(...ys) - 3000,
      Math.min(...ys),
      4000,
      Math.max(...ys),
      Math.max(...ys) + 3000,
    ]) {
      const drop = dropOf(doc, level(doc), room, object, { x, y })
      try {
        applyCommand(doc, updateObject, { id: object.id, ...drop })
      } catch (error) {
        refused.push(`${x},${y}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  expect(refused).toEqual([])
})
