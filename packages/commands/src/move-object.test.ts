import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askScript, runScript } from './run'

const HOUSE = [
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name house',
  'add-object --room house --type sofa-3 --against south',
  'add-object --room house --type nightstand --against north --along 0.2',
  'add-object --room house --type nightstand --against north --along 0.8',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)

const objects = (doc: HouseDocument) => Object.values(doc.objects)
const sofa = (doc: HouseDocument) => objects(doc).find((it) => it.type === 'sofa-3')!
const stands = (doc: HouseDocument, type: string) =>
  objects(doc)
    .filter((it) => it.type === type)
    .sort((one, other) => one.id.localeCompare(other.id))

test('a thing moved to another side is placed on it the way a new thing would be', () => {
  const doc = runScript(house(), 'move-object --room house --type sofa-3 --against north')

  expect(sofa(doc)).toMatchObject({ against: 'north' })
  // Between the two nightstands, in the middle of the clear stretch.
  expect(sofa(doc).along).toBeCloseTo(0.5, 1)
})

test('a thing slid along its wall keeps the wall', () => {
  const doc = runScript(house(), 'move-object --room house --type sofa-3 --along 0.25')

  expect(sofa(doc)).toMatchObject({ against: 'south', along: 0.25 })
})

test('a thing moved across the room comes off the wall', () => {
  const doc = runScript(house(), 'move-object --room house --type sofa-3 --across 0.5')

  expect(sofa(doc).against).toBeUndefined()
  expect(sofa(doc)).toMatchObject({ along: 0.5, across: 0.5 })
})

test('the nth of a kind is the one moved, and describe counts them the same way', () => {
  const doc = runScript(house(), 'move-object --room house --type nightstand --nth 1 --along 0.05')

  expect(stands(doc, 'nightstand').map((it) => it.along)).toEqual([0.05, 0.8])
  const [report] = askScript(doc, 'describe --room house') as {
    objects: { type: string; nth?: number; along: number }[]
  }[]
  expect(report!.objects.filter((it) => it.type === 'nightstand').map((it) => it.nth)).toEqual([
    1, 2,
  ])
  expect(report!.objects.find((it) => it.type === 'sofa-3')!.nth).toBeUndefined()
})

test('a move onto something already there is refused, and says what is in the way', () => {
  expect(() =>
    runScript(house(), 'move-object --room house --type sofa-3 --against north --along 0.2'),
  ).toThrow(/cannot go against the north side of house: it would stand in the nightstand/)
})

test('a move has to say where', () => {
  expect(() => runScript(house(), 'move-object --room house --type sofa-3')).toThrow(/say where/)
  expect(() =>
    runScript(house(), 'move-object --room house --type sofa-3 --against north --across 0.5'),
  ).toThrow(/not both/)
})

test('asking for a thing that is not there says so by number', () => {
  expect(() =>
    runScript(house(), 'move-object --room house --type nightstand --nth 3 --along 0.5'),
  ).toThrow(/no 3th nightstand|there are 2/)
})

test('a turn is kept and added to, and a full circle comes off', () => {
  const turned = runScript(house(), 'turn-object --room house --type sofa-3 --by 90')
  expect(sofa(turned).turn).toBe(90)

  const more = runScript(turned, 'turn-object --room house --type sofa-3 --by 270')
  expect(sofa(more).turn).toBeUndefined()

  const set = runScript(more, 'turn-object --room house --type sofa-3 --to -45')
  expect(sofa(set).turn).toBe(-45)
})

test('a turn that would put a thing into its wall is refused', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name house',
      'add-room --material natural-oak --name nook --from house --side west --width 1.3m',
      // Narrow and deep: it stands along the north wall, and turned it would not.
      'add-object --room nook --type sofa-3 --against north --width 1000 --depth 2000',
    ].join('\n'),
  )

  expect(() => runScript(doc, 'turn-object --room nook --type sofa-3 --by 90')).toThrow(
    /cannot turn to 90°.*outside nook/,
  )
})
