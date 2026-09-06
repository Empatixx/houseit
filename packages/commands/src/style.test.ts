import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const HOUSE = [
  'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
  'add-room --material natural-oak --name bath --from house --side west --width 3m --kind bathroom',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const record = (doc: HouseDocument, name: string) =>
  Object.values(doc.rooms).find((room) => room.name === name)!

test('a style dresses the whole room, and a bathroom gets the bathroom floor', () => {
  const doc = runScript(house(), 'update-room --room house --style industrial')
  const bath = runScript(doc, 'update-room --room bath --style industrial')

  expect(record(doc, 'house')).toMatchObject({
    style: 'industrial',
    floor: 'concrete-light',
    walls: 'concrete-light',
    ceiling: 'concrete-light',
    doors: 'white',
    windows: 'black',
  })
  expect(record(bath, 'bath').floor).toBe('tile-beige')
})

test('one part can be finished on its own and stays when the floor changes', () => {
  const doc = runScript(house(), 'update-room --room house --walls oak-paneling')
  const relaid = runScript(doc, 'update-room --room house --material beech')

  expect(record(relaid, 'house')).toMatchObject({ walls: 'oak-paneling', floor: 'beech' })
  expect(record(relaid, 'house').style).toBeUndefined()
  expect(() => runScript(doc, 'update-room --room house --doors tile-white')).toThrow()
})

test('the answer says what a room is dressed in', () => {
  const doc = runScript(house(), 'update-room --room house --style rustic --doors walnut')
  const room = askPlan(doc, 'get-plan --room house').rooms[0]!

  expect(room.style).toBe('rustic')
  expect(room.finishes).toEqual({
    walls: 'oak-paneling',
    ceiling: 'oak-paneling',
    doors: 'walnut',
    windows: 'oak-medium',
  })
})
