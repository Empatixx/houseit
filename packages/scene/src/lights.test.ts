import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { lightsOn } from './lights'

const house = () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  doc.rooms.r1 = { id: 'r1', level, x: 2000, y: 1500, name: 'room', loop: [] }
  return { doc, level }
}

const lamp = (id: string, type: string, level: string) =>
  ({
    id,
    level,
    room: 'r1',
    type,
    along: 0.5,
    width: 400,
    depth: 400,
    surface: 'grey',
  }) as never

test('a room with no lamp in it is lit by nothing of its own', () => {
  const { doc, level } = house()

  expect(lightsOn(doc, level)).toEqual([])
})

test('a floor lamp is a light, and it burns near the top of its stem where the shade is', () => {
  const { doc, level } = house()
  doc.objects.o1 = lamp('o1', 'floor-lamp', level)

  const [lit] = lightsOn(doc, level)
  expect(lit).toBeDefined()
  expect(lit!.at.y).toBeGreaterThan(1200)
  expect(lit!.at.y).toBeLessThan(1600)
})

test('a table lamp burns above the table it was put on, not above the floor', () => {
  const { doc, level } = house()
  doc.objects.o1 = lamp('o1', 'table-lamp', level)

  const [lit] = lightsOn(doc, level)
  expect(lit!.at.y).toBeGreaterThan(700)
})

test('a lamp burns warm, because that is what a lamp in a house does', () => {
  const { doc, level } = house()
  doc.objects.o1 = lamp('o1', 'floor-lamp', level)

  expect(lightsOn(doc, level)[0]!.colour).toMatch(/^#[0-9a-f]{6}$/)
})

test('a sofa is not a lamp', () => {
  const { doc, level } = house()
  doc.objects.o1 = lamp('o1', 'sofa-3', level)

  expect(lightsOn(doc, level)).toEqual([])
})
