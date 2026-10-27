// @vitest-environment node
import { runScript } from '@houseit/commands/run'
import { createEmptyDocument } from '@houseit/core/document'
import * as OBC from '@thatopen/components'
import { expect, test } from 'vitest'
import { exportBcf, importBcf } from './bcf'

test('topics go out as a BCF zip and come back with their view, comments and selection', async () => {
  const plan = runScript(
    createEmptyDocument(),
    'add-room --name Flat --shape rectangle --width 8m --depth 5m --material natural-oak',
  )
  const flat = Object.values(plan.rooms)[0]!.id
  const doc = runScript(
    plan,
    [
      `add-viewpoint --name "from the door" --mode 3d --camera '{"projection":"perspective","position":{"x":4000,"y":-1000,"z":1600},"direction":{"x":0,"y":1,"z":0},"up":{"x":0,"y":0,"z":1},"fieldOfView":55}'`,
      `add-topic --title "Move the radiator" --about '["${flat}"]' --viewpoint v1 --author jirka --comment "under the window" --date 2026-10-27T10:00:00Z`,
      'update-topic --id t1 --status resolved --comment done --author mistr --date 2026-10-28T10:00:00Z',
    ].join('\n'),
  )
  const guid = '2O2Fr$t4X7Zf8NOew3FNr2'
  const blob = await exportBcf(new OBC.Components(), doc, (id) => (id === flat ? guid : undefined))
  const back = await importBcf(new OBC.Components(), new Uint8Array(await blob.arrayBuffer()))
  expect(back.views).toEqual([
    {
      guid: expect.any(String),
      name: 'Move the radiator',
      camera: {
        projection: 'perspective',
        position: { x: 4000, y: -1000, z: 1600 },
        direction: { x: 0, y: 1, z: 0 },
        up: { x: 0, y: 0, z: 1 },
        fieldOfView: 55,
      },
    },
  ])
  expect(back.topics).toEqual([
    expect.objectContaining({
      title: 'Move the radiator',
      status: 'resolved',
      author: 'jirka',
      viewpoint: back.views[0]!.guid,
      about: [guid],
      comments: [
        { author: 'jirka', date: '2026-10-27T10:00:00.000Z', text: 'under the window' },
        { author: 'mistr', date: '2026-10-28T10:00:00.000Z', text: 'done' },
      ],
    }),
  ])
})
