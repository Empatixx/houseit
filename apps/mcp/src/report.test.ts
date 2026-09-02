import type { ExecResult, Output } from '@houseit/bridge/contract'
import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { compactJson, report, toolDescription } from './report'

const ok = (rooms: { name?: string; area: number }[], output: Output[] = []): ExecResult => ({
  ok: true,
  document: createEmptyDocument(),
  rooms,
  output,
})

test('reports each room with its name and area in square metres', () => {
  const text = report(ok([{ name: 'kitchen', area: 15_120_000 }]))

  expect(text).toContain('kitchen')
  expect(text).toContain('15.1')
})

test('says so plainly when the plan holds no rooms yet', () => {
  expect(report(ok([]))).toMatch(/no rooms/i)
})

test('names an unnamed room rather than leaving a gap', () => {
  expect(report(ok([{ area: 6_000_000 }]))).toMatch(/unnamed/i)
})

test('what a describe or measure said comes back as JSON, in place of the room count', () => {
  const text = report(
    ok([{ name: 'kitchen', area: 15_120_000 }], [{ room: 'kitchen', width: 4200 }]),
  )

  expect(JSON.parse(text)).toEqual({ room: 'kitchen', width: 4200 })
  expect(text).not.toMatch(/Done/)
})

test('passes a failure through as the message the command produced', () => {
  const text = report({ ok: false, error: 'add-room: unknown option --colour' })

  expect(text).toContain('unknown option --colour')
})

test('the tool description carries the full command help, so the agent needs no docs', () => {
  const description = toolDescription()

  expect(description).toContain('add-room')
  expect(description).toContain('--name')
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
