import { createEmptyDocument } from '@houseit/core/document'
import { applyPatches } from 'immer'
import { expect, test } from 'vitest'
import { runScriptWithPatches } from './patches'

const script = 'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name dům'

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
