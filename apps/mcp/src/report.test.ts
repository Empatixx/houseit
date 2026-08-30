import type { ExecResult } from '@houseit/bridge/contract'
import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { report, toolDescription } from './report'

const ok = (rooms: { name?: string; area: number }[]): ExecResult => ({
  ok: true,
  document: createEmptyDocument(),
  rooms,
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

test('passes a failure through as the message the command produced', () => {
  const text = report({ ok: false, error: 'add-room: unknown option --colour' })

  expect(text).toContain('unknown option --colour')
})

test('the tool description carries the full command help, so the agent needs no docs', () => {
  const description = toolDescription()

  expect(description).toContain('add-room')
  expect(description).toContain('--name')
})
