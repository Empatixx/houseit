import { runScript } from '@houseit/commands/run'
import { createEmptyDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { expect, test } from 'vitest'
import { startOf } from './start'

const house = (...lines: string[]) => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --material natural-oak --shape rectangle --width 6m --depth 5m --name kitchen',
      ...lines,
    ].join('\n'),
  )
  return { doc, level: Object.keys(doc.levels)[0]! }
}

/** How far the start is from the nearest bit of anything standing in the room. */
const clearanceOf = (
  doc: ReturnType<typeof house>['doc'],
  level: string,
  at: { x: number; y: number },
) => {
  const room = roomsOf(doc, level)[0]!
  return Object.values(doc.objects).reduce((least, object) => {
    const spot = standingAt(doc, level, room, object)
    if (!spot) return least
    return piecesOf(spot, object).reduce((closest, piece) => {
      const xs = piece.map((corner) => corner.x)
      const ys = piece.map((corner) => corner.y)
      const away = Math.hypot(
        Math.max(Math.min(...xs) - at.x, 0, at.x - Math.max(...xs)),
        Math.max(Math.min(...ys) - at.y, 0, at.y - Math.max(...ys)),
      )
      return Math.min(closest, away)
    }, least)
  }, Infinity)
}

test('an empty room starts the walk in the middle of it', () => {
  const { doc, level } = house()

  expect(startOf(doc, level)?.at).toEqual({ x: 3000, y: 2500 })
})

test('a walk does not start inside the furniture', () => {
  // A dining table in the middle is exactly where the room's label hangs, which
  // is where the walk used to open: standing in the table, looking at a wall.
  const { doc, level } = house('add-object --room kitchen --type dining-6 --along 0.5')

  const start = startOf(doc, level)

  expect(start).toBeDefined()
  expect(clearanceOf(doc, level, start!.at)).toBeGreaterThan(400)
})

test('a walk faces in towards the room rather than out at the wall behind it', () => {
  const { doc, level } = house('add-object --room kitchen --type dining-6 --along 0.5')

  const start = startOf(doc, level)!
  // Facing the middle: a step forward is a step closer to it.
  const step = {
    x: start.at.x + Math.sin(start.yaw) * 100,
    y: start.at.y + Math.cos(start.yaw) * 100,
  }
  const middle = { x: 3000, y: 2500 }
  expect(Math.hypot(step.x - middle.x, step.y - middle.y)).toBeLessThan(
    Math.hypot(start.at.x - middle.x, start.at.y - middle.y),
  )
})

test('nowhere to start while there are no rooms', () => {
  expect(startOf(createEmptyDocument(), 'nothing')).toBeUndefined()
})
