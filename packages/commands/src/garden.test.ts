import { createEmptyDocument } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { expect, test } from 'vitest'
import { runScript } from './run'

const garden = () =>
  runScript(
    createEmptyDocument(),
    [
      'add-room --name Zahrada --kind lawn --material grass --boundary \'[{"x":0,"y":0,"thickness":100},{"x":14000,"y":0,"thickness":100},{"x":14000,"y":10000,"thickness":100},{"x":0,"y":10000,"thickness":100}]\'',
      'add-room --name Rybnik --from Zahrada --corner south-east --width 5m --depth 3.6m --kind pond --material water',
      'add-object --room Zahrada --type tree-deciduous --along 0.3 --across 0.6',
      'add-object --room Zahrada --type shrub-round --along 0.39 --across 0.6',
      'add-object --room Zahrada --type hedge --against north --width 6000',
      'add-object --room Rybnik --type water-lilies',
      'add-object --room Rybnik --type fish-koi --along 0.3',
    ].join('\n'),
  )

test('a garden is planted and a pond stocked through the commands', () => {
  const doc = garden()
  const rooms = Object.values(doc.rooms)
  expect(rooms.find((room) => room.name === 'Rybnik')?.kind).toBe('pond')
  const types = Object.values(doc.objects)
    .map((object) => object.type)
    .sort()
  expect(types).toEqual(['fish-koi', 'hedge', 'shrub-round', 'tree-deciduous', 'water-lilies'])
})

test('a shrub may stand under a tree, because only the trunk takes ground', () => {
  expect(() => garden()).not.toThrow()
})

test('lilies float on the water and koi swim under it', () => {
  expect(heightOf('water-lilies').base).toBeLessThan(0)
  expect(heightOf('fish-koi').base).toBeLessThan(heightOf('water-lilies').base)
})
