import { createEmptyDocument } from '@houseit/core/document'
import type { Site } from '@houseit/core/parcel-site'
import { expect, test } from 'vitest'
import { addSite } from './add-site'
import { quoted } from './command-line'
import { applyWithPatches } from './patches'
import { removeSite } from './remove-site'
import { runScript } from './run'
import { updateSite } from './update-site'

const site = (): Site => ({
  parcel: {
    id: 'parcel-1',
    nationalReference: '1-1',
    number: '1',
    cadastralAreaCode: '1',
    cadastralAreaName: 'Test',
    areaM2: 400,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 20_000, y: 0 },
          { x: 20_000, y: 20_000 },
          { x: 0, y: 20_000 },
        ],
        holes: [],
      },
    ],
  },
  source: {
    provider: 'cuzk-inspire-cp',
    fetchedAt: '2026-09-13T12:00:00.000Z',
    crs: 'EPSG:5514',
    originXmm: 0,
    originYmm: 0,
    attributionYear: 2026,
  },
  housePlacement: { xMm: 1000, yMm: 1000, rotationMilliDegrees: 0 },
  setbacks: { defaultMm: 0, byEdge: {} },
})

const room = (width: string, depth = '8m') =>
  `add-room --material natural-oak --shape rectangle --width ${width} --depth ${depth} --name house`

test('adds and removes a site through typed commands and patches', () => {
  const before = createEmptyDocument()
  const added = applyWithPatches(before, addSite, { json: JSON.stringify(site()) })

  expect(added.doc.parcelSite?.parcel.id).toBe('parcel-1')
  expect(added.patches.length).toBeGreaterThan(0)

  const removed = applyWithPatches(added.doc, removeSite, {})
  expect(removed.doc.parcelSite).toBeUndefined()
})

test('adds a site through the same textual command surface', () => {
  const command = `add-site --json ${quoted(JSON.stringify(site()))}`

  expect(runScript(createEmptyDocument(), command).parcelSite?.parcel.number).toBe('1')
})

test('updates placement, the default setback and one edge', () => {
  const withSite = applyWithPatches(createEmptyDocument(), addSite, {
    json: JSON.stringify(site()),
  }).doc

  const moved = applyWithPatches(withSite, updateSite, {
    x: 2500,
    y: 3000,
    rotation: 12.5,
    setback: 1000,
    edge: 'p0:r0:e0',
    edgeSetback: 2000,
  }).doc

  expect(moved.parcelSite?.housePlacement).toEqual({
    xMm: 2500,
    yMm: 3000,
    rotationMilliDegrees: 12_500,
  })
  expect(moved.parcelSite?.setbacks).toEqual({
    defaultMm: 1000,
    byEdge: { 'p0:r0:e0': 2000 },
  })
})

test('rejects a setback override for an edge that is not in the parcel', () => {
  const withSite = applyWithPatches(createEmptyDocument(), addSite, {
    json: JSON.stringify(site()),
  }).doc

  expect(() =>
    applyWithPatches(withSite, updateSite, {
      edge: 'p0:r0:e99',
      edgeSetback: 7000,
    }),
  ).toThrow(/unknown parcel edge/i)
  expect(withSite.parcelSite?.setbacks.byEdge).toEqual({})
})

test('allows a house inside the selected parcel', () => {
  const add = `add-site --json ${quoted(JSON.stringify(site()))}`

  expect(() => runScript(createEmptyDocument(), [add, room('8m')].join('\n'))).not.toThrow()
})

test('rejects a house outside the selected parcel', () => {
  const add = `add-site --json ${quoted(JSON.stringify(site()))}`

  expect(() => runScript(createEmptyDocument(), [add, room('25m')].join('\n'))).toThrow(
    /outside the parcel/i,
  )
})

test('rejects a wall movement that crosses the parcel limit', () => {
  const add = `add-site --json ${quoted(JSON.stringify(site()))}`
  const doc = runScript(createEmptyDocument(), [add, room('8m')].join('\n'))

  expect(() => runScript(doc, 'update-room --room house --side east --by 20m')).toThrow(
    /outside the parcel/i,
  )
  expect(Object.values(doc.nodes).some((node) => node.x > 8000)).toBe(false)
})

test('rolls an invalid multi-command script back as one transaction', () => {
  const add = `add-site --json ${quoted(JSON.stringify(site()))}`
  const before = runScript(createEmptyDocument(), add)

  expect(() =>
    runScript(before, [room('8m'), 'update-room --room house --side east --by 20m'].join('\n')),
  ).toThrow(/outside the parcel/i)
  expect(before.walls).toEqual({})
})
