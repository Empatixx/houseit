import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan, runScript } from './run'

const HOUSE = [
  'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
  'add-object --room house --type sofa-3 --against south',
  'add-object --room house --type nightstand --against north --along 0.2',
  'add-object --room house --type nightstand --against north --along 0.8',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)

const ids = () => askPlan(createEmptyDocument(), HOUSE).changed.filter((id) => id.startsWith('f'))

const objects = (doc: HouseDocument) => Object.values(doc.objects)
const sofa = (doc: HouseDocument) => objects(doc).find((it) => it.type === 'sofa-3')!
const stands = (doc: HouseDocument) =>
  objects(doc)
    .filter((it) => it.type === 'nightstand')
    .sort((one, other) => one.id.localeCompare(other.id))

test('a thing moved to another side is placed on it the way a new thing would be', () => {
  const [id] = ids()
  const doc = runScript(house(), `update-object --id ${id} --against north`)

  expect(sofa(doc)).toMatchObject({ against: 'north' })
  expect(sofa(doc).along).toBeCloseTo(0.5, 1)
})

test('a thing slid along its wall keeps the wall', () => {
  const [id] = ids()
  const doc = runScript(house(), `update-object --id ${id} --along 0.25`)

  expect(sofa(doc)).toMatchObject({ against: 'south', along: 0.25 })
})

test('a thing moved across the room comes off the wall', () => {
  const [id] = ids()
  const doc = runScript(house(), `update-object --id ${id} --across 0.5`)

  expect(sofa(doc).against).toBeUndefined()
  expect(sofa(doc)).toMatchObject({ along: 0.5, across: 0.5 })
})

test('the id names which of two alike, and the other stays where it was', () => {
  const [, first] = ids()
  const doc = runScript(house(), `update-object --id ${first} --along 0.05`)

  expect(stands(doc).map((it) => it.along)).toEqual([0.05, 0.8])
})

test('a move onto something already there is refused, and says what is in the way', () => {
  const [id] = ids()

  expect(() => runScript(house(), `update-object --id ${id} --against north --along 0.2`)).toThrow(
    /cannot go against the north side of house: it would stand in the nightstand/,
  )
})

test('a change has to say what, and a wall and the open room are not both', () => {
  const [id] = ids()

  expect(() => runScript(house(), `update-object --id ${id}`)).toThrow(/say what to change/)
  expect(() => runScript(house(), `update-object --id ${id} --against north --across 0.5`)).toThrow(
    /not both/,
  )
})

test('asking for a thing that is not there says so by name', () => {
  expect(() => runScript(house(), 'update-object --id f99 --along 0.5')).toThrow(
    /nothing called f99/,
  )
})

test('a turn is a number the thing keeps, and zero is no turn at all', () => {
  const [id] = ids()
  const turned = runScript(house(), `update-object --id ${id} --rotation 90`)
  expect(sofa(turned).rotation).toBe(90)

  const again = runScript(turned, `update-object --id ${id} --rotation -45`)
  expect(sofa(again).rotation).toBe(-45)

  const straight = runScript(again, `update-object --id ${id} --rotation 0`)
  expect(sofa(straight).rotation).toBeUndefined()
})

test('a turn that would put a thing into its wall is refused', () => {
  const script = [
    'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
    'add-room --material natural-oak --name nook --from house --side west --width 1.3m',
    'add-object --room nook --type sofa-3 --against north --width 1000 --depth 2000',
  ].join('\n')
  const doc = runScript(createEmptyDocument(), script)
  const id = askPlan(createEmptyDocument(), script).changed.find((it) => it.startsWith('f'))!

  expect(() => runScript(doc, `update-object --id ${id} --rotation 90`)).toThrow(
    /does not fit where it stands in nook.*outside nook/,
  )
})
