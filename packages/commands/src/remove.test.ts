import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { runScript } from './run'

const room = () =>
  runScript(
    createEmptyDocument(),
    'floor-shape --material oak --kind rectangle --width 6m --depth 4m --name pokoj',
  )

const build = (script: string[]) => runScript(room(), script.join('\n'))
const things = (doc: HouseDocument) => Object.values(doc.objects)
const openings = (doc: HouseDocument) => Object.values(doc.openings)

test('something put in a room can be taken out of it again', () => {
  const doc = build([
    'add-object --room pokoj --type table',
    'remove-object --room pokoj --type table',
  ])

  expect(things(doc)).toEqual([])
})

test('the one put in last comes out first, so removing undoes adding', () => {
  const doc = build([
    'add-object --room pokoj --type chair --surface oak',
    'add-object --room pokoj --type chair --surface black',
    'remove-object --room pokoj --type chair',
  ])

  expect(things(doc).map((thing) => thing.surface)).toEqual(['oak'])
})

test('only the type asked for is taken out', () => {
  const doc = build([
    'add-object --room pokoj --type table',
    'add-object --room pokoj --type rug',
    'remove-object --room pokoj --type rug',
  ])

  expect(things(doc).map((thing) => thing.type)).toEqual(['table'])
})

test('taking out something that was never there says so', () => {
  expect(() => build(['remove-object --room pokoj --type table'])).toThrow(/no dining table/i)
})

test('a window can be taken out of the side it went into', () => {
  const doc = build([
    'add-window --room pokoj --side south',
    'remove-window --room pokoj --side south',
  ])

  expect(openings(doc)).toEqual([])
})

test('a door is not taken out by asking for a window, nor the other way about', () => {
  const doc = build([
    'add-window --room pokoj --side south --width 1m',
    'add-door --room pokoj --side south --width 0.8m',
    'remove-window --room pokoj --side south',
  ])

  expect(openings(doc).map((opening) => opening.kind)).toEqual(['door'])
})

test('a door can be taken out too', () => {
  const doc = build(['add-door --room pokoj --side north', 'remove-door --room pokoj --side north'])

  expect(openings(doc)).toEqual([])
})

test('taking a window out of a side that has none says so', () => {
  expect(() => build(['remove-window --room pokoj --side north'])).toThrow(/no window/i)
})
