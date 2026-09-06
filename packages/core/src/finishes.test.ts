import { expect, test } from 'vitest'
import { FINISHES, finishesFor, PARTS, STYLES } from './finishes'
import { FLOOR_MATERIAL_IDS } from './floor-materials'

test('every finish has one id and either a picture or a colour', () => {
  const ids = FINISHES.map((finish) => finish.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const finish of FINISHES) {
    expect(Boolean(finish.picture) !== Boolean(finish.colour)).toBe(true)
  }
})

test('every style picks a floor the plan can lay and a finish each part can wear', () => {
  expect(STYLES.length).toBeGreaterThanOrEqual(8)
  for (const style of STYLES) {
    expect(FLOOR_MATERIAL_IDS).toContain(style.defaults.floor)
    expect(FLOOR_MATERIAL_IDS).toContain(style.defaults.bathroomFloor)
    for (const part of PARTS) {
      expect(finishesFor(part).map((finish) => finish.id)).toContain(style.defaults[part])
    }
  }
})

test('a door is not clad in tile and a wall is not painted with a metal', () => {
  expect(finishesFor('doors').map((finish) => finish.category)).not.toContain('tile')
  expect(finishesFor('walls').map((finish) => finish.category)).not.toContain('metal')
  expect(finishesFor('walls').map((finish) => finish.id)).toContain('oak-paneling')
  expect(finishesFor('ceiling').map((finish) => finish.id)).toContain('concrete-light')
})
