import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import type { Site } from '@houseit/core/parcel-site'
import { enclosuresOf } from '@houseit/geometry/enclosure'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { checkLevel } from './checks'
import { runScript } from './run'

const LOT = [
  'add-room --name Dlažba --kind paving --shape rectangle --width 12m --depth 10m --material brick-grey --thickness 100',
  'add-room --name Chodník --kind path --from Dlažba --points "0,0; 12m,0; 12m,2m; 0,2m" --thickness 100 --material limestone',
  'add-room --name Dům --from Dlažba --points "2m,2m; 6m,2m; 6m,8m; 2m,8m" --thickness 300 --material natural-oak',
]
const GARDEN =
  'add-room --name "Zimní zahrada" --from Dlažba --points "6m,2m; 9m,2m; 9m,8m; 6m,8m" --thickness 100 --material tile-terracotta'

const parcel = (width: number, depth: number, setback: number): Site => ({
  parcel: {
    id: 'parcel-1',
    nationalReference: '1-1',
    number: '1',
    cadastralAreaCode: '1',
    cadastralAreaName: 'Test',
    areaM2: (width * depth) / 1_000_000,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: depth },
          { x: 0, y: depth },
        ],
        holes: [],
      },
    ],
  },
  source: {
    provider: 'cuzk-inspire-cp',
    fetchedAt: '2026-09-14T12:00:00.000Z',
    crs: 'EPSG:5514',
    originXmm: 0,
    originYmm: 0,
    attributionYear: 2026,
  },
  housePlacement: { xMm: 0, yMm: 0, rotationMilliDegrees: 0 },
  setbacks: { defaultMm: setback, byEdge: {} },
})

const onSite = (site: Site): HouseDocument => ({ ...createEmptyDocument(), parcelSite: site })

const built = (doc: HouseDocument, lines: string[]) => {
  const after = runScript(doc, lines.join('\n'))
  const level = Object.keys(after.levels)[0]!
  const rooms = roomsOf(after, level)
  return {
    doc: after,
    level,
    found: enclosuresOf(after, level, rooms),
    room: (name: string) => rooms.find((room) => room.name === name)!,
  }
}

test('the house stands in its paving, and the paving stops at an edge', () => {
  const { found, room } = built(createEmptyDocument(), LOT)
  const house = room('Dům')
  const outer = room('Dlažba').walls.filter((wall) => !house.walls.includes(wall))

  expect(new Set(house.walls.map((wall) => found.get(wall)))).toEqual(new Set(['wall']))
  expect(new Set(outer.map((wall) => found.get(wall)))).toEqual(new Set(['edge']))
})

test('a winter garden is glass to the garden and the house wall to the house', () => {
  const { found, room } = built(createEmptyDocument(), [...LOT, GARDEN])
  const house = room('Dům')
  const garden = room('Zimní zahrada')
  const shared = garden.walls.filter((wall) => house.walls.includes(wall))
  const open = garden.walls.filter((wall) => !house.walls.includes(wall))

  expect(shared.length).toBeGreaterThan(0)
  expect(new Set(shared.map((wall) => found.get(wall)))).toEqual(new Set(['wall']))
  expect(new Set(open.map((wall) => found.get(wall)))).toEqual(new Set(['glass']))
})

test('only the house keeps to the setbacks; its paving may run up to the boundary', () => {
  expect(() => built(onSite(parcel(12_000, 10_000, 1500)), [...LOT, GARDEN])).not.toThrow()
})

test('the winter garden is part of the house, and keeps to the setbacks with it', () => {
  expect(() => built(onSite(parcel(12_000, 10_000, 3500)), [...LOT, GARDEN])).toThrow(
    /outside the parcel or its setbacks/,
  )
})

test('paving that runs past the boundary is refused', () => {
  expect(() => built(onSite(parcel(11_000, 10_000, 0)), LOT)).toThrow(/reach outside the parcel/)
})

test('a door out onto the paving is a way into the house, and paving wants no door', () => {
  const { doc, level } = built(createEmptyDocument(), [
    ...LOT,
    'add-opening --room Dům --kind door --side south',
  ])
  const problems = checkLevel(doc, level)

  expect(problems.map((problem) => problem.code)).not.toContain('house.no-entrance')
  expect(problems.filter((problem) => problem.room === 'Dlažba')).toEqual([])
})

test('a house cut along the edge of a path takes that stretch at the thickness of a house wall', () => {
  const { doc, room } = built(createEmptyDocument(), [
    'add-room --name Dlažba --kind paving --shape rectangle --width 12m --depth 10m --material brick-grey --thickness 100',
    'add-room --name Chodník --from Dlažba --points "0,0; 12m,0; 12m,2m; 0,2m" --thickness 100 --material limestone',
    'add-room --name Dům --from Dlažba --points "3m,2m; 8m,2m; 8m,7m; 3m,7m" --thickness 300 --material natural-oak',
  ])

  const thicknesses = room('Dům').walls.map((wall) => doc.walls[wall]!.thickness)
  expect(new Set(thicknesses)).toEqual(new Set([300]))
})
