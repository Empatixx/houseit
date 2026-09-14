import { createEmptyDocument } from '@houseit/core/document'
import { applyPatches } from 'immer'
import { expect, test, vi } from 'vitest'
import { runScriptWithPatches } from './patches'
import * as rebinding from './rebind'

const script = 'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name dům'

test('reading does not invoke topology rebinding', () => {
  const { doc } = runScriptWithPatches(createEmptyDocument(), script)
  const rebind = vi.spyOn(rebinding, 'rebindAll')
  try {
    runScriptWithPatches(doc, 'get-plan\nget-plan --room dům')
    expect(rebind.mock.calls.length).toBe(0)
  } finally {
    rebind.mockRestore()
  }
})

test('reports the patches that produced the new document', () => {
  const before = createEmptyDocument()

  const { doc, patches } = runScriptWithPatches(before, script)

  expect(patches.length).toBeGreaterThan(0)
  expect(applyPatches(before, patches)).toEqual(doc)
})

test('reports inverse patches that undo the change exactly', () => {
  const before = createEmptyDocument()

  const { doc, inversePatches } = runScriptWithPatches(before, script)

  expect(applyPatches(doc, inversePatches)).toEqual(before)
})

test('a failing script produces no patches and no document change', () => {
  const before = createEmptyDocument()

  expect(() => runScriptWithPatches(before, 'no-such-command')).toThrow()
  expect(before.walls).toEqual({})
})

test.each(['get-plan', 'get-plan --room dům', 'get-plan\nget-plan --room dům'])(
  '%s reads a populated document without producing patches',
  (source) => {
    const { doc: before } = runScriptWithPatches(createEmptyDocument(), script)

    const result = runScriptWithPatches(before, source)

    expect(result.doc).toBe(before)
    expect(result.patches).toEqual([])
    expect(result.inversePatches).toEqual([])
    expect(result.touched.changed).toEqual([])
    expect(result.touched.shown).toEqual(Object.keys(before.rooms))
  },
)
