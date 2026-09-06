import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const ROOM = 'add-room --material natural-oak --shape rectangle --width 6m --depth 4m --name pokoj'

const room = () => runScript(createEmptyDocument(), ROOM)
const things = (doc: HouseDocument) => Object.values(doc.objects)
const openings = (doc: HouseDocument) => Object.values(doc.openings)

const made = (script: string[]) => askPlan(room(), script.join('\n')).changed

test('something put in a room can be taken out of it again by the id it was given', () => {
  const [thing] = made(['add-object --room pokoj --type dining-6'])
  const doc = runScript(
    room(),
    `add-object --room pokoj --type dining-6\nremove-object --id ${thing}`,
  )

  expect(things(doc)).toEqual([])
})

test('the id names which of two alike, so the first can go and the second stay', () => {
  const script = [
    'add-object --room pokoj --type office-chair --surface fabric',
    'add-object --room pokoj --type office-chair --surface grey',
  ]
  const [first] = made(script)
  const doc = runScript(room(), [...script, `remove-object --id ${first}`].join('\n'))

  expect(things(doc).map((thing) => thing.surface)).toEqual(['grey'])
})

test('taking out something that was never there says so', () => {
  expect(() => runScript(room(), 'remove-object --id f9')).toThrow(/nothing called f9/i)
})

test('a window can be taken out by its id', () => {
  const script = ['add-opening --kind window --room pokoj --side south']
  const [window_] = made(script)
  const doc = runScript(room(), [...script, `remove-opening --id ${window_}`].join('\n'))

  expect(openings(doc)).toEqual([])
})

test('one opening out of a wall holding two leaves the other where it was', () => {
  const script = [
    'add-opening --kind window --room pokoj --side south --width 1m',
    'add-opening --kind door --room pokoj --side south --width 0.8m',
  ]
  const [window_] = made(script)
  const doc = runScript(room(), [...script, `remove-opening --id ${window_}`].join('\n'))

  expect(openings(doc).map((opening) => opening.kind)).toEqual(['door'])
})

test('a door comes out the same way a window does, since they are one thing', () => {
  const script = ['add-opening --kind door --room pokoj --side north']
  const [door] = made(script)
  const doc = runScript(room(), [...script, `remove-opening --id ${door}`].join('\n'))

  expect(openings(doc)).toEqual([])
})

test('taking out an opening that is not there says so', () => {
  expect(() => runScript(room(), 'remove-opening --id o3')).toThrow(/no door or window called o3/i)
})

test('what went is named in the answer, along with the room it went from', () => {
  const script = ['add-object --room pokoj --type dining-6']
  const [thing] = made(script)
  const answer = askPlan(room(), [...script, `remove-object --id ${thing}`].join('\n'))

  expect(answer.changed).toContain(thing)
  expect(answer.rooms.map((room) => room.name)).toEqual(['pokoj'])
  expect(answer.rooms[0]!.objects).toEqual([])
})
