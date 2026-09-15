// @vitest-environment node
import { readFileSync } from 'node:fs'
import { updateSite } from '@houseit/commands/update-site'
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

test.each(['columns', 'connections', 'three-flights', 'site'])(
  '%s CLI elements have independent native identities and ordered parent relationships',
  (name) => {
    const { authoring, level } = make()
    const initial = authoring.graph
    try {
      authoring.exec(
        readFileSync(
          new URL(`../../../../fixtures/building-proof/${name}.txt`, import.meta.url),
          'utf8',
        ),
        level,
      )
      const graph = authoring.graph
      const ids = keyed(authoring)
      for (const storey of Object.values(authoring.document.levels)) {
        const parent = ids.get(`levels:${storey.id}`)!
        const parameters = JSON.parse(String(graph.items.get(parent)!.data.Parameters!.value))
        for (const collection of ['columns', 'roofs', 'ramps', 'shafts', 'stairs'] as const) {
          expect(parameters).not.toHaveProperty(collection)
          const records = storey[collection]
          if (!records?.length) continue
          const children = graph.relations.get(parent)!.data[`HasParts:${collection}`]!
          expect(children).toHaveLength(records.length)
          expect(
            children.map(
              (id) => JSON.parse(String(graph.items.get(id)!.data.Parameters!.value)).id,
            ),
          ).toEqual(records.map((record) => record.id))
          for (const id of children)
            expect(graph.relations.get(id)!.data.ContainedIn).toEqual([parent])
        }
      }
      expect(
        JSON.parse(String(graph.items.get(ids.get('project')!)!.data.Parameters!.value)),
      ).not.toHaveProperty('site')
      if (name === 'connections') {
        const ramp = [...graph.items].find(([, item]) => item.category === 'IFCRAMP')![0]
        expect(graph.relations.get(ramp)!.data.ConnectsTo).toHaveLength(1)
        expect(
          JSON.parse(String(graph.items.get(ramp)!.data.Parameters!.value)),
        ).not.toHaveProperty('to')
      }
      if (name === 'site') {
        const marking = [...graph.items].find(
          ([, item]) => item.category === 'IFCSURFACEFEATURE',
        )![0]
        const surface = graph.relations.get(marking)!.data.MappedTo![0]!
        expect(JSON.parse(String(graph.items.get(surface)!.data.Parameters!.value)).id).toBe('bay')
      }
      expect(documentFromGraph(graph)).toEqual(authoring.document)
      authoring.undo()
      expect(authoring.graph).toEqual(initial)
      authoring.redo()
      expect(authoring.graph).toEqual(graph)
      const broken = authoring.graph
      const child = [...broken.items].find(
        ([, item]) =>
          item.category ===
          (name === 'site'
            ? 'IFCSURFACEFEATURE'
            : name === 'three-flights'
              ? 'IFCSTAIR'
              : 'IFCCOLUMN'),
      )![0]
      broken.relations.get(child)!.data.ContainedIn = [ids.get('project')!]
      expect(() => documentFromGraph(broken)).toThrow(/Fragment relationships/)
    } finally {
      authoring.dispose()
    }
  },
)

test('roof identity survives replacing legacy roof JSON, renaming, reordering and undo', () => {
  const { authoring, level } = make()
  try {
    authoring.exec(
      readFileSync(
        new URL('../../../../fixtures/building-proof/columns.txt', import.meta.url),
        'utf8',
      ),
      level,
    )
    const first = authoring.document.levels[level]!.roofs![0]!
    const originalIds = keyed(authoring)
    const { id: _, ...legacy } = first
    const set = (roofs: unknown[]) =>
      authoring.exec(`update-level --roofs '${JSON.stringify(roofs)}'`, level)
    set([{ ...legacy, depth: legacy.depth + 10 }])
    expect(authoring.document.levels[level]!.roofs![0]!.id).toBe(first.id)
    set([{ ...authoring.document.levels[level]!.roofs![0]!, name: 'Renamed' }])
    const renamed = authoring.document.levels[level]!.roofs![0]!
    set([renamed, { ...legacy, name: 'Second' }])
    const pair = authoring.document.levels[level]!.roofs!
    expect(pair[0]!.id).not.toBe(pair[1]!.id)
    set([...pair].reverse())
    expect(authoring.document.levels[level]!.roofs!.map((roof) => roof.id)).toEqual([
      pair[1]!.id,
      first.id,
    ])
    for (const [key, id] of originalIds) expect(keyed(authoring).get(key)).toBe(id)
    authoring.undo()
    expect(authoring.document.levels[level]!.roofs).toEqual(pair)
    authoring.redo()
    const before = authoring.graph
    expect(() => set([renamed, renamed])).toThrow(/Duplicate roof id/)
    expect(authoring.graph).toEqual(before)
    set([])
    expect([...authoring.graph.items.values()].some((item) => item.category === 'IFCROOF')).toBe(
      false,
    )
    authoring.undo()
    expect(authoring.graph).toEqual(before)
  } finally {
    authoring.dispose()
  }
})

test('native edits preserve terrain and parcel together, enforce setbacks and undo parcel changes', () => {
  const { authoring, level } = make()
  const parcel = {
    parcel: {
      id: 'p1',
      nationalReference: '1-1',
      number: '1',
      cadastralAreaCode: '1',
      cadastralAreaName: 'Test',
      areaM2: 400,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 20000, y: 0 },
            { x: 20000, y: 20000 },
            { x: 0, y: 20000 },
          ],
          holes: [],
        },
      ],
    },
    source: {
      provider: 'cuzk-inspire-cp',
      fetchedAt: '2026-09-15T12:00:00.000Z',
      crs: 'EPSG:5514',
      originXmm: 0,
      originYmm: 0,
      attributionYear: 2026,
    },
    housePlacement: { xMm: 5000, yMm: 5000, rotationMilliDegrees: 0 },
    setbacks: { defaultMm: 2000, byEdge: {} },
  }
  const terrain = {
    groundCutout: { x0: 0, x1: 10000, y0: 0, y1: 10000 },
    surfaces: [],
    markings: [],
    railings: [],
  }
  try {
    authoring.exec(
      `add-site --json '${JSON.stringify(parcel)}'
update-site --site '${JSON.stringify(terrain)}'
add-room --name House --material natural-oak --width 6m --depth 6m --shape rectangle`,
      level,
    )
    expect(authoring.document.parcelSite).toEqual(parcel)
    expect(authoring.document.site).toEqual(terrain)
    const before = authoring.document
    const history = authoring.history
    expect(() => authoring.apply(updateSite, { x: 19000 }, level)).toThrow(/outside/)
    expect(() => authoring.exec('update-site --x 19m', level)).toThrow(/outside/)
    expect(authoring.document).toEqual(before)
    expect(authoring.history).toEqual(history)
    authoring.apply(updateSite, { x: 6000 }, level)
    expect(authoring.document.parcelSite?.housePlacement.xMm).toBe(6000)
    authoring.undo()
    expect(authoring.document).toEqual(before)
    authoring.redo()
    expect(authoring.document.parcelSite?.housePlacement.xMm).toBe(6000)
    authoring.exec('remove-site', level)
    expect(authoring.document.parcelSite).toBeUndefined()
    expect(authoring.document.site).toEqual(terrain)
    authoring.undo()
    expect(documentFromGraph(authoring.graph)).toEqual(authoring.document)
  } finally {
    authoring.dispose()
  }
})

test('version-five native project metadata loads with terrain retained', () => {
  const { authoring, level } = make()
  try {
    authoring.exec(
      readFileSync(
        new URL('../../../../fixtures/building-proof/site.txt', import.meta.url),
        'utf8',
      ),
      level,
    )
    const graph = authoring.graph
    const project = [...graph.items.values()].find((item) => nativeKey(item) === 'project')!
    const parameters = JSON.parse(String(project.data.Parameters!.value))
    project.data.Parameters!.value = JSON.stringify({ ...parameters, version: 5 })
    expect(documentFromGraph(graph)).toEqual(authoring.document)
  } finally {
    authoring.dispose()
  }
})
