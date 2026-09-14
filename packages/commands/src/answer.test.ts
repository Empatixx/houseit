import { createEmptyDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { answerFor } from './answer'
import { checkLevel, checkStorey } from './checks'
import { runScript } from './run'
import { surveyLevel } from './survey'

const script = [
  'add-room --name house --width 10000 --depth 6000 --material natural-oak',
  'add-room --name kitchen --from house --side west --width 3000 --material tile-white',
].join('\n')

test('shared readback reports match a full survey and never leak between answers or revisions', () => {
  const doc = runScript(createEmptyDocument(), script)
  const level = Object.keys(doc.levels)[0]!
  const ids = Object.keys(doc.rooms)
  const answer = answerFor(doc, level, [ids[0]!], ids)
  const surveyed = new Map(surveyLevel(doc, level).rooms.map((room) => [room.id, room]))
  expect(answer.rooms).toEqual(ids.map((id) => surveyed.get(id)))
  expect(answer.problems).toEqual(checkLevel(doc, level))
  answer.rooms[0]!.name = 'mutated response'
  const changed = runScript(doc, 'update-room --room house --name living')
  expect(answerFor(changed, level, [], ids).rooms.map((room) => room.name)).toContain('living')
  expect(answerFor(doc, level, [], ids).rooms.map((room) => room.name)).toContain('house')
})

test('profession validation shares one storey context and keeps error-first reporting', () => {
  const doc = runScript(createEmptyDocument(), script)
  const level = Object.keys(doc.levels)[0]!
  const storey = { doc, level, rooms: roomsOf(doc, level), reports: surveyLevel(doc, level).rooms }
  const seen: unknown[] = []
  const problems = checkStorey(storey, [
    {
      discipline: 'electrical',
      rules: [
        (context) => {
          seen.push(context)
          return [{ code: 'electrical.sample', severity: 'warning', message: 'sample warning' }]
        },
      ],
    },
    {
      discipline: 'plumbing',
      rules: [
        (context) => {
          seen.push(context)
          return [{ code: 'plumbing.sample', severity: 'error', message: 'sample error' }]
        },
      ],
    },
  ])
  expect(seen).toEqual([storey, storey])
  expect(problems.map((problem) => problem.code)).toEqual(['plumbing.sample', 'electrical.sample'])
})
