import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const PLAN = [
  'add-room --material natural-oak --shape rectangle --width 8m --depth 6m --name flat',
  'add-room --material tile-white --from flat --side west --width 3m --name bath',
].join('\n')
const camera = JSON.stringify({
  projection: 'perspective',
  position: { x: 4000, y: -3000, z: 1600 },
  direction: { x: 0, y: 1, z: 0 },
  up: { x: 0, y: 0, z: 1 },
  fieldOfView: 60,
})

test('a remark is pinned to a room with a saved view and gathers comments', () => {
  const plan = runScript(createEmptyDocument(), PLAN)
  const bath = Object.values(plan.rooms).find((it) => it.name === 'bath')!.id
  const doc = runScript(
    plan,
    [
      `add-viewpoint --name "into the bath" --mode 3d --camera '${camera}'`,
      `add-topic --title "Tile the bath to the ceiling" --about '["${bath}"]' --viewpoint v1 --author jirka --comment "the client asked" --date 2026-10-27T10:00:00Z`,
      'update-topic --id t1 --status in-progress --comment "priced" --author stavbyvedouci --date 2026-10-28T09:00:00Z',
    ].join('\n'),
  )
  expect(doc.topics!.t1).toMatchObject({
    title: 'Tile the bath to the ceiling',
    status: 'in-progress',
    about: [bath],
    viewpoint: 'v1',
    comments: [
      { author: 'jirka', text: 'the client asked' },
      { author: 'stavbyvedouci', text: 'priced' },
    ],
  })
  expect(askPlan(doc, 'get-plan').topics).toEqual([
    {
      id: 't1',
      title: 'Tile the bath to the ceiling',
      status: 'in-progress',
      about: [bath],
      comments: 2,
      viewpoint: 'v1',
    },
  ])
})

test('a topic outlives what it was about, and loses only the pointer', () => {
  const plan = runScript(createEmptyDocument(), PLAN)
  const bath = Object.values(plan.rooms).find((it) => it.name === 'bath')!.id
  const doc = runScript(
    plan,
    [
      `add-viewpoint --name here --mode plan --camera '${camera}'`,
      `add-topic --title "Check the bath" --about '["${bath}"]' --viewpoint v1`,
      'remove-room --room bath --into flat',
      'remove-viewpoint --id v1',
    ].join('\n'),
  )
  expect(doc.topics!.t1!.about).toEqual([])
  expect(doc.topics!.t1!.viewpoint).toBeUndefined()
})

test('a topic about nothing that exists is refused', () => {
  expect(() =>
    runScript(runScript(createEmptyDocument(), PLAN), `add-topic --title x --about '["r99"]'`),
  ).toThrow(/no room, wall, door, window or thing r99/)
})
