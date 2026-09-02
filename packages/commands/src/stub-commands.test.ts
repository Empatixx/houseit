import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

const FLOOR =
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name dům'
const STUB = 'add-wall --room dům --side north --along 0.5 --length 3m'
const house = () => runScript(createEmptyDocument(), `${FLOOR}\n${STUB}`)
const walls = (doc: HouseDocument) => Object.values(doc.walls)
const rooms = (doc: HouseDocument) => roomsOf(doc, Object.keys(doc.levels)[0]!)

test('a stub is taken out, and the wall it hung from is whole again', () => {
  const doc = runScript(house(), 'remove-wall --room dům --side north --along 0.5')

  expect(walls(doc)).toHaveLength(4)
  expect(Object.values(doc.nodes)).toHaveLength(4)
  expect(rooms(doc)).toHaveLength(1)
})

test('a stub is named by where it hangs, near enough', () => {
  expect(() => runScript(house(), 'remove-wall --room dům --side north --along 0.52')).not.toThrow()
  expect(() => runScript(house(), 'remove-wall --room dům --side north --along 0.2')).toThrow(
    /there is one at 0.5/,
  )
  expect(() => runScript(house(), 'remove-wall --room dům --side south --along 0.5')).toThrow(
    /no wall stub hangs off the south side/,
  )
})

test('a stub made longer stays a stub; long enough, it becomes a partition', () => {
  const longer = runScript(house(), 'resize-wall --room dům --side north --along 0.5 --length 5m')
  expect(rooms(longer)).toHaveLength(1)
  const tip = Object.values(longer.nodes).find((node) => node.x === 6000 && node.y === 4000)
  expect(tip).toBeDefined()

  const across = runScript(house(), 'resize-wall --room dům --side north --along 0.5 --length 8.9m')
  expect(rooms(across)).toHaveLength(2)
})

test('a wall with both ends attached is not a stub, and says so', () => {
  const cut = runScript(
    createEmptyDocument(),
    `${FLOOR}\nadd-wall --room dům --side north --along 0.5`,
  )

  expect(() => runScript(cut, 'remove-wall --room dům --side north --along 0.5')).toThrow(
    /no wall stub/,
  )
})
