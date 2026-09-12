// @vitest-environment node
import { readFileSync } from 'node:fs'
import { updateWall } from '@houseit/commands/wall'
import { createEmptyDocument } from '@houseit/core/document'
import { SingleThreadedFragmentsModel } from '@thatopen/fragments'
import { expect, test, vi } from 'vitest'
import { documentFromGraph, nativeKey } from './authoring-graph'
import { FragmentAuthoring } from './fragment-authoring'

const fixture = readFileSync(
  new URL('../../../../fixtures/that-open/wall-house.txt', import.meta.url),
  'utf8',
)
const make = () => {
  const doc = createEmptyDocument()
  return { authoring: new FragmentAuthoring(doc), level: Object.keys(doc.levels)[0]! }
}
const keyed = (authoring: FragmentAuthoring) =>
  new Map([...authoring.graph.items].map(([id, item]) => [nativeKey(item), id]))

test('CLI builds native independent walls, spaces and hosted openings with shared junctions', () => {
  const { authoring, level } = make()
  try {
    authoring.exec(fixture, level)
    const graph = authoring.graph
    const ids = keyed(authoring)
    expect([...graph.items.values()].filter((item) => item.category === 'IFCWALL')).toHaveLength(5)
    expect([...graph.items.values()].filter((item) => item.category === 'IFCSPACE')).toHaveLength(2)
    expect(
      [...graph.items.values()].filter((item) => item.category === 'IFCOPENINGELEMENT'),
    ).toHaveLength(4)
    expect(graph.relations.get(ids.get('openings:o2')!)!.data.VoidsElement).toEqual([
      ids.get('elements:w3'),
    ])
    expect(
      [...graph.items].some(
        ([id, item]) =>
          item.category === 'HOUSEITJUNCTION' &&
          (graph.relations.get(id)?.data.ConnectedSegments?.length ?? 0) >= 3,
      ),
    ).toBe(true)
    expect(documentFromGraph(graph)).toEqual(authoring.document)
    const before = structuredClone(graph)
    const nativeId = ids.get('elements:w3')
    authoring.apply(updateWall, { id: 'w3', by: -250 }, level)
    expect(keyed(authoring).get('elements:w3')).toBe(nativeId)
    expect(authoring.document).not.toEqual(documentFromGraph(before))
    authoring.undo()
    expect(authoring.graph).toEqual(before)
    authoring.redo()
    expect(keyed(authoring).get('elements:w3')).toBe(nativeId)
    expect(authoring.document).not.toEqual(documentFromGraph(before))
  } finally {
    authoring.dispose()
  }
})

test('closed spaces exist as native IFCSPACE elements before they have room labels', () => {
  const { authoring, level } = make()
  try {
    authoring.exec(
      fixture
        .split('\n')
        .filter((line) => !line.startsWith('add-room'))
        .join('\n'),
      level,
    )
    expect(Object.keys(authoring.document.rooms)).toHaveLength(0)
    expect(
      [...authoring.graph.items.values()].filter((item) => item.category === 'IFCSPACE'),
    ).toHaveLength(2)
    authoring.undo()
    expect([...authoring.graph.items.values()].some((item) => item.category === 'IFCSPACE')).toBe(
      false,
    )
  } finally {
    authoring.dispose()
  }
})

test('a native edit failure rolls back requests and preserves a previous redo branch', () => {
  const { authoring, level } = make()
  try {
    authoring.exec(fixture, level)
    authoring.apply(updateWall, { id: 'w3', by: -250 }, level)
    const moved = authoring.document
    authoring.undo()
    const before = authoring.graph
    const history = authoring.history
    const edit = SingleThreadedFragmentsModel.prototype.edit
    const failing = vi
      .spyOn(SingleThreadedFragmentsModel.prototype, 'edit')
      .mockImplementationOnce(function (this: SingleThreadedFragmentsModel, requests) {
        edit.call(this, requests)
        throw new Error('Injected native write failure')
      })
    try {
      expect(() => authoring.apply(updateWall, { id: 'w3', by: -500 }, level)).toThrow(
        'Injected native write failure',
      )
    } finally {
      failing.mockRestore()
    }
    expect(authoring.graph).toEqual(before)
    expect(authoring.history).toEqual(history)
    authoring.redo()
    expect(authoring.document).toEqual(moved)
  } finally {
    authoring.dispose()
  }
})

test('a failed CLI script and a read-only query leave the native graph and history intact', () => {
  const { authoring, level } = make()
  try {
    authoring.exec(fixture, level)
    const before = authoring.graph
    const history = authoring.history
    expect(() => authoring.exec('update-wall --id w3 --by -500\nunknown-command', level)).toThrow(
      'unknown-command',
    )
    authoring.exec('get-plan', level)
    expect(authoring.graph).toEqual(before)
    expect(authoring.history).toEqual(history)
  } finally {
    authoring.dispose()
  }
})

test('readback rejects missing room boundaries and conflicting physical opening hosts', () => {
  const { authoring, level } = make()
  try {
    authoring.exec(fixture, level)
    const ids = keyed(authoring)
    const brokenRoom = authoring.graph
    delete brokenRoom.relations.get(ids.get('rooms:r1')!)!.data.BoundedBy
    expect(() => documentFromGraph(brokenRoom)).toThrow(/Fragment relationships/)
    const brokenHost = authoring.graph
    brokenHost.relations.get(ids.get('openings:o2')!)!.data.VoidsElement = [ids.get('elements:w1')!]
    expect(() => documentFromGraph(brokenHost)).toThrow(/Fragment relationships/)
    expect(documentFromGraph(authoring.graph)).toEqual(authoring.document)
  } finally {
    authoring.dispose()
  }
})
