import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { runScript } from './run'

const HOUSE = 'add-room --name dům --shape rectangle --width 10m --depth 8m --material natural-oak'

const coats = (script: string) =>
  Object.values(runScript(createEmptyDocument(), script).walls)
    .filter((wall) => wall.exterior)
    .map((wall) => wall.exterior!)

test('a facade material covers every exterior wall, and a side only that side', () => {
  const all = coats(`${HOUSE}\nupdate-facade --material render-white`)
  expect(all).toHaveLength(4)
  expect(all.every((coat) => coat.material === 'render-white')).toBe(true)
  const south = coats(`${HOUSE}\nupdate-facade --material larch-vertical --side south`)
  expect(south).toHaveLength(1)
})

test('a band goes on top of the coat and replaces what it overlaps', () => {
  const [coat] = coats(
    `${HOUSE}\nupdate-facade --material render-white\nupdate-facade --material stone --from 0 --to 400\nupdate-facade --material brick-red --from 200 --to 600`,
  )
  expect(coat!.bands.map((band) => [band.material, band.from, band.to])).toEqual([
    ['brick-red', 200, 600],
  ])
})

test('a house style is a roof and a facade together', () => {
  const doc = runScript(createEmptyDocument(), `${HOUSE}\nupdate-house --style classic`)
  const roof = Object.values(doc.levels)[0]!.roofs![0]!
  expect(roof).toMatchObject({ material: 'roof-tiles', pitched: { shape: 'gable', pitch: 40 } })
  const coat = Object.values(doc.walls).find((wall) => wall.exterior)!.exterior!
  expect(coat.material).toBe('render-white')
  expect(coat.bands[0]).toMatchObject({ material: 'stone', from: 0, to: 450 })
})
