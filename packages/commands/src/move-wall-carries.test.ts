import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

const PLAN = [
  'add-room --material natural-oak --shape rectangle --width 8m --depth 6m --name flat',
  'add-room --material tile-white --from flat --side west --width 3m --name laundry',
].join('\n')

const PLACINGS = [
  ['against north', 'add-object --room laundry --type washer-dryer-stacked --against north'],
  ['against south', 'add-object --room laundry --type washer-dryer-stacked --against south'],
  ['against east', 'add-object --room laundry --type washer-dryer-stacked --against east'],
  ['against west', 'add-object --room laundry --type washer-dryer-stacked --against west'],
  [
    'free-standing',
    'add-object --room laundry --type washer-dryer-stacked --across 0.5 --along 0.5',
  ],
] as const

const built = (placing: string) => runScript(createEmptyDocument(), `${PLAN}\n${placing}`)

const move = (doc: HouseDocument, side: string, by: number) =>
  runScript(doc, `update-room --room laundry --side ${side} --by ${by}`)

const where = (doc: HouseDocument) => {
  const object = Object.values(doc.objects)[0]!
  return { against: object.against ?? '-', along: object.along, across: object.across ?? 0 }
}

const MILLIMETRE_IN_FRACTION = 1 / 3000

test('room-side moves retain valid furniture or refuse the complete edit', () => {
  const stuck: string[] = []
  for (const [name, placing] of PLACINGS) {
    for (const side of ['east', 'west']) {
      for (const by of [-600, -1200, 600, 1200]) {
        const doc = built(placing)
        const before = JSON.stringify(doc)
        try {
          move(doc, side, by)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (!/f1.*(fit|outside)/.test(message)) stuck.push(`${name}: ${message}`)
          expect(JSON.stringify(doc)).toBe(before)
        }
      }
    }
  }
  expect(stuck).toEqual([])
})

test('a valid wall drag gives the same furniture placement in one or several steps', () => {
  const apart: string[] = []
  for (const [name, placing] of PLACINGS) {
    for (const side of ['east', 'west']) {
      for (const total of [-300, 1200]) {
        for (const steps of [2, 4, 12]) {
          const step = total / steps
          if (!Number.isInteger(step)) continue
          let slow = built(placing)
          let flick = built(placing)
          try {
            flick = move(flick, side, total)
          } catch {
            expect(() => {
              for (let i = 0; i < steps; i += 1) slow = move(slow, side, step)
            }).toThrow(/f1/)
            continue
          }
          try {
            for (let i = 0; i < steps; i += 1) slow = move(slow, side, step)
          } catch (error) {
            apart.push(
              `${name} ${side} ${total} in ${steps}: refused ${error instanceof Error ? error.message : error}`,
            )
            continue
          }
          const a = where(slow)
          const b = where(flick)
          if (
            a.against !== b.against ||
            Math.abs(a.along - b.along) > MILLIMETRE_IN_FRACTION ||
            Math.abs(a.across - b.across) > MILLIMETRE_IN_FRACTION
          ) {
            apart.push(
              `${name} ${side} ${total} in ${steps}: slow ${JSON.stringify(a)} vs flick ${JSON.stringify(b)}`,
            )
          }
        }
      }
    }
  }
  expect(apart).toEqual([])
})

const FURNISHED = [
  'add-room --material natural-oak --shape rectangle --width 9m --depth 7m --name flat',
  'add-room --material beech --from flat --side north --depth 3m --kind bedroom --name bedroom',
  'add-room --material tile-white --from flat --side west --width 2.4m --kind bathroom --name bath',
  'add-opening --room bedroom --kind door --side south --width 800 --along 0.5',
  'add-opening --room bedroom --kind window --side north --along 0.5',
  'add-opening --room bath --kind door --side east --width 700 --along 0.5',
  'add-opening --room flat --kind window --side south --width 2.4m --along 0.5',
  'add-object --room bedroom --type queen-bed --against north',
  'add-object --room flat --type sofa-3 --against south',
].join('\n')

test('room-side moves either retain supported openings or report a refused transaction', () => {
  const start = runScript(createEmptyDocument(), FURNISHED)
  const level = Object.keys(start.levels)[0]!
  const refused = { shrink: [] as string[], grow: [] as string[] }
  for (const room of roomsOf(start, level)) {
    if (!room.name) continue
    for (const side of ['north', 'east', 'south', 'west']) {
      for (const by of [-300, -800, -2000, -3000, 300, 800, 2000, 3000]) {
        try {
          runScript(start, `update-room --room "${room.name}" --side ${side} --by ${by}`)
        } catch (error) {
          const said = error instanceof Error ? error.message : String(error)
          refused[by < 0 ? 'shrink' : 'grow'].push(`${room.name}/${side} ${by}: ${said}`)
        }
      }
    }
  }
  expect([...refused.shrink, ...refused.grow].length).toBeGreaterThan(0)
  expect([...refused.shrink, ...refused.grow].every((said) => said.includes('move-wall:'))).toBe(
    true,
  )
})
