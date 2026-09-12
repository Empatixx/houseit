import type { ExecResult } from '@houseit/bridge/contract'
import type { Page } from 'playwright-core'
import { afterEach, expect, test, vi } from 'vitest'
import { execOnPage } from './editor-page'

const page = { evaluate: (run: (source: string) => unknown, source: string) => run(source) } as Page
const applied = { ok: true, answer: {}, document: {}, rooms: [] } as unknown as ExecResult

afterEach(() => vi.unstubAllGlobals())

test('MCP and CLI wait for native persistence before returning success', async () => {
  let finish!: () => void
  const saved = new Promise<void>((resolve) => {
    finish = resolve
  })
  const save = vi.fn(() => saved)
  vi.stubGlobal('window', { floorplan: { exec: () => applied, save } })
  let done = false
  const result = execOnPage(page, 'command').then((value) => {
    done = true
    return value
  })
  await Promise.resolve()
  expect(save).toHaveBeenCalledOnce()
  expect(done).toBe(false)
  finish()
  expect(await result).toBe(applied)
})

test('a failed save reports that the edit was applied and can be retried', async () => {
  vi.stubGlobal('window', {
    floorplan: {
      exec: () => applied,
      save: async () => {
        throw new Error('disk full')
      },
    },
  })
  expect(await execOnPage(page, 'command')).toEqual({
    ok: false,
    error: 'The edit was applied, but saving the native model failed: disk full',
  })
})

test('an invalid transaction returns its command error without attempting a save', async () => {
  const failed = { ok: false, error: 'invalid host' }
  const save = vi.fn()
  vi.stubGlobal('window', { floorplan: { exec: () => failed, save } })
  expect(await execOnPage(page, 'command')).toBe(failed)
  expect(save).not.toHaveBeenCalled()
})
