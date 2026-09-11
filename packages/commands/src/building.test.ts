import { readFileSync } from 'node:fs'
import { createEmptyDocument, parseDocument } from '@houseit/core/document'
import { openingsIn } from '@houseit/core/opening-parts'
import { treadsOf } from '@houseit/core/stairs'
import { roomsOf } from '@houseit/geometry/rooms'
import { walkClear, walkSurface } from '@houseit/geometry/walking'
import { wellsIn } from '@houseit/geometry/wells'
import { expect, test } from 'vitest'
import { runScript } from './run'

const measured = `add-room --name Cafe --material ceramic-tile --boundary '[{"x":0,"y":0,"thickness":300},{"x":9000,"y":0,"thickness":150},{"x":9000,"y":8000,"thickness":300},{"x":0,"y":8000,"thickness":300}]'
add-room --name Prep --material vinyl --boundary '[{"x":9000,"y":0,"thickness":300},{"x":12000,"y":0,"thickness":300},{"x":12000,"y":5000,"thickness":150},{"x":9000,"y":5000,"thickness":150}]'`

test('measured adjacent rooms share their wall and preserve the L-shaped notch', () => {
  const doc = runScript(createEmptyDocument(), measured)
  const level = Object.keys(doc.levels)[0]!
  const rooms = roomsOf(doc, level)
  expect(rooms).toHaveLength(2)
  expect(rooms.every((r) => !!r.id)).toBe(true)
  expect(rooms.reduce((sum, r) => sum + r.area, 0)).toBe(87_000_000)
  expect(rooms[0]!.walls.filter((id) => rooms[1]!.walls.includes(id))).toHaveLength(1)
  expect(rooms[0]!.clear).toBe(67_567_500)
  expect(() => runScript(doc, measured.split('\n')[0]!)).toThrow('already a room')
  parseDocument(doc)
})

test('a structural column keeps its grid position and blocks placement and walking', () => {
  const doc = runScript(
    createEmptyDocument(),
    `${measured}\nadd-column --x 3000 --y 4000 --width 400 --depth 400 --colour "#b0b0b0"\nupdate-level --height 3550`,
  )
  const level = Object.keys(doc.levels)[0]!
  expect(doc.levels[level]!.columns?.[0]?.x).toBe(3000)
  expect(walkClear(doc, level, { x: 3000, y: 3900 })).toBe(false)
  expect(walkClear(doc, level, { x: 3400, y: 3900 })).toBe(true)
  expect(() =>
    runScript(doc, 'add-column --x 3000 --y 4000 --width 400 --depth 400 --colour "#b0b0b0"'),
  ).toThrow('another column')
  expect(() =>
    runScript(
      doc,
      'add-object --room Cafe --type box --width 400 --depth 400 --along 0.333333 --across 0.5',
    ),
  ).toThrow('column')
})

test('an assembly is one product, with a door only in its door panel', () => {
  const doc = runScript(
    createEmptyDocument(),
    `${measured}\nadd-opening --room Cafe --kind assembly --side south --width 2000 --height 2800 --frame '{"depth":74,"face":60,"outside":"#383e42","inside":"#ffffff"}' --panels '[{"kind":"door","x":0,"z":0,"width":1000,"height":2100},{"kind":"fixed","x":0,"z":2100,"width":1000,"height":700},{"kind":"fixed","x":1000,"z":0,"width":1000,"height":2800}]'`,
  )
  const parent = Object.values(doc.openings)[0]!
  expect(Object.keys(doc.openings)).toHaveLength(1)
  expect(openingsIn(doc)).toHaveLength(3)
  expect(openingsIn(doc).filter((o) => o.kind === 'door')).toHaveLength(1)
  expect(() => runScript(doc, `update-opening --id ${parent.id} --width 2100`)).toThrow(
    'cover the opening',
  )
  expect(doc.openings[parent.id]!.width).toBe(2000)
  parseDocument(doc)
})

test('a shaft pierces each storey in its declared span', () => {
  const doc = runScript(
    createEmptyDocument(),
    `update-level --name Low --height 3295
add-room --name LowRoom --width 10000 --depth 8000 --material epoxy
add-level --name High --height 3550
add-room --level High --name HighRoom --width 10000 --depth 8000 --material ceramic-tile
add-shaft --level Low --to High --x 8000 --y 6000 --width 1200 --depth 1500`,
  )
  const high = Object.values(doc.levels).find((l) => l.name === 'High')!
  expect(wellsIn(doc, high.id).map((w) => w.type)).toContain('lift-shaft')
  expect(walkSurface(doc, { x: 8000, y: 6000 }, high.elevation)).toBeUndefined()
  expect(() => runScript(doc, 'remove-level --level High')).toThrow('remove its shafts')
})

test('walking the ramp follows its actual rise in both directions', () => {
  const doc = runScript(
    createEmptyDocument(),
    `update-level --name Low --height 3295
add-room --name LowRoom --width 20000 --depth 8000 --material epoxy
add-level --name High --height 3550
add-room --level High --name HighRoom --width 20000 --depth 8000 --material ceramic-tile
add-ramp --level Low --to High --x 1000 --y 4000 --width 2500 --length 16000 --direction east --thickness 250 --colour "#b0b0b0"`,
  )
  for (const forward of [true, false]) {
    let height = forward ? 0 : 3295
    for (let i = 0; i <= 100; i++) {
      const t = forward ? i / 100 : 1 - i / 100
      const surface = walkSurface(doc, { x: 1000 + 16000 * t, y: 4000 }, height)
      expect(surface?.height).toBeCloseTo(3295 * t)
      height = surface!.height
    }
  }
})

test('the measured three-flight stair wraps one enclosed shaft and reaches the next floor', () => {
  const script = readFileSync(
    new URL('../../../fixtures/building-proof/three-flights.txt', import.meta.url),
    'utf8',
  )
  const doc = runScript(createEmptyDocument(), script)
  const low = Object.values(doc.levels).find((l) => l.name === '1.PP')!
  const high = Object.values(doc.levels).find((l) => l.name === '1.NP')!
  expect(roomsOf(doc, low.id)).toHaveLength(1)
  expect(roomsOf(doc, low.id)[0]!.clear).toBe(27_900_000)
  expect(roomsOf(doc, high.id)[0]!.clear).toBe(27_900_000)
  const stair = low.stairs![0]!
  expect(treadsOf(stair).map((t) => t.step)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  expect(walkSurface(doc, { x: 875, y: 5380 }, -2186.67)?.height).toBeCloseTo(-2186.67, 1)
  expect(walkSurface(doc, { x: 5380, y: 5380 }, -1093.33)?.height).toBeCloseTo(-1093.33, 1)
  expect(walkSurface(doc, { x: 5380, y: 1000 }, -156)?.height).toBe(0)
  expect(walkClear(doc, high.id, { x: 3125, y: 2855 })).toBe(false)
  expect(wellsIn(doc, high.id).some((w) => w.object === stair.id)).toBe(true)
  const shaftLine = script.split('\n').find((line) => line.startsWith('add-shaft'))!
  expect(() => runScript(doc, shaftLine)).toThrow('overlap another shaft')
  expect(() =>
    runScript(
      doc,
      'add-column --level "1.NP" --x 3125 --y 2855 --width 400 --depth 400 --colour "#aaaaaa"',
    ),
  ).toThrow('lift shaft')
  parseDocument(doc)
})

test('a section can state the soffit independently from the next finished floor', () => {
  const doc = runScript(
    createEmptyDocument(),
    'update-level --height 3670 --slab-thickness 250 --clear-height 3300',
  )
  const level = Object.values(doc.levels)[0]!
  expect(level.clearHeight).toBe(3300)
  expect(() => runScript(doc, 'update-level --clear-height 3500')).toThrow(
    'must fit between finished floors',
  )
})

test('embedded columns remove only their intersection with a room floor', () => {
  const room =
    'add-room --name Grid --material epoxy --boundary \'[{"x":-125,"y":-125,"thickness":250},{"x":6125,"y":-125,"thickness":250},{"x":6125,"y":6125,"thickness":250},{"x":-125,"y":6125,"thickness":250}]\''
  const doc = runScript(
    createEmptyDocument(),
    `${room}
add-column --x 0 --y 0 --width 500 --depth 500 --embedded --colour "#aaaaaa"
add-column --x 3000 --y 0 --width 500 --depth 500 --embedded --colour "#aaaaaa"
add-column --x 3000 --y 3000 --width 500 --depth 500 --colour "#aaaaaa"`,
  )
  const level = Object.keys(doc.levels)[0]!
  expect(roomsOf(doc, level)[0]!.clear).toBe(36_000_000 - 250 * 250 - 500 * 250 - 500 * 500)
  expect(() =>
    runScript(doc, 'add-column --x 6000 --y 6000 --width 500 --depth 500 --colour "#aaaaaa"'),
  ).toThrow()
  expect(() =>
    runScript(
      doc,
      'add-column --x 12000 --y 12000 --width 500 --depth 500 --embedded --colour "#aaaaaa"',
    ),
  ).toThrow()
})
