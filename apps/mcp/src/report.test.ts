import type { ExecResult } from '@houseit/bridge/contract'
import type { Answer } from '@houseit/commands/answer'
import type { RoomReport } from '@houseit/commands/survey'
import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { compactJson, guidelinesText, helpText, report, toolDescription } from './report'

const ok = (answer: Partial<Answer>, project?: string): ExecResult => ({
  ok: true,
  document: createEmptyDocument(),
  rooms: [],
  ...(project === undefined ? {} : { project: { id: project, name: project } }),
  answer: { level: 'l1', levels: [], changed: [], rooms: [], problems: [], ...answer } as Answer,
})

test('the answer comes back as JSON: what changed, the rooms, what is wrong', () => {
  const rooms = [{ id: 'r1', name: 'kitchen', areaM2: 15.1 }] as RoomReport[]
  const text = report(ok({ changed: ['f7'], rooms }))

  const [, ...json] = text.split('\n')
  expect(JSON.parse(json.join('\n'))).toMatchObject({
    changed: ['f7'],
    rooms: [{ name: 'kitchen', areaM2: 15.1 }],
  })
})

test('the plan it was about is named, since the agent did not choose it', () => {
  expect(report(ok({}, 'byt-praha'))).toMatch(/^byt-praha\n/)
})

test('what is wrong with the plan rides along without being asked for', () => {
  const text = report(
    ok({
      problems: [
        { code: 'door.blocked', severity: 'error', message: 'a door in pracovna cannot open' },
      ],
    }),
  )

  expect(text).toContain('door.blocked')
})

test('passes a failure through as the message the command produced', () => {
  const text = report({ ok: false, error: 'add-room: unknown option --colour' })

  expect(text).toContain('unknown option --colour')
})

test('the tool description never names a command or a catalogue, so it cannot churn', () => {
  const description = toolDescription()

  expect(description).not.toContain('--notch-width')
  expect(description).not.toContain('sofa-3')
  expect(description).not.toContain('natural-oak')
  expect(description).toContain('help')
  expect(description).toContain('guidelines')
})

test('the guidelines say what each disposition holds and what the standard asks', () => {
  const text = guidelinesText()

  for (const id of ['1+kk', '2+kk', '3+kk', '3+1', '5+kk']) expect(text).toContain(id)
  expect(text).toContain('obytné místnosti')
  expect(text).toContain('146/2024')
})

test('the command list is there for the asking, with the options on it', () => {
  const help = helpText()

  expect(help).toContain('add-room')
  expect(help).toContain('--name')
  expect(help).toContain('update-object')
})

test('short things stay on one line and long things open out, and it is still JSON', () => {
  const value = {
    room: 'kitchen',
    walls: [
      { side: 'north', length: 4200 },
      { side: 'south', length: 4200 },
    ],
    objects: Array.from({ length: 6 }, (_, i) => ({
      type: `thing-${i}`,
      along: i / 6,
      width: 1000,
    })),
  }

  const text = compactJson(value)

  expect(JSON.parse(text)).toEqual(value)
  expect(text).toContain('{"side":"north","length":4200}')
  expect(text.split('\n').length).toBeLessThan(15)
})
