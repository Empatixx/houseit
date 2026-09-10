import { expect, test } from 'vitest'
import { FINISHES, finishesFor, PARTS, STYLES, wornAs } from './finishes'
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

test('a finish is a name from the list or a colour of your own', () => {
  expect(wornAs('white', 'walls')).toBe('white')
  expect(wornAs('#c86432', 'walls')).toBe('#c86432')
  expect(wornAs('#C86432', 'walls')).toBe('#c86432')
})

test('a colour of your own is allowed on every part, since paint is', () => {
  for (const part of PARTS) expect(wornAs('#123456', part)).toBe('#123456')
})

test('a name the part cannot wear is refused, so a floor tile is no door', () => {
  expect(() => wornAs('brick-red', 'doors')).toThrow(/doors/)
})

test('a colour that is not a colour is refused rather than stored as a name', () => {
  expect(() => wornAs('#fff', 'walls')).toThrow(/walls/)
  expect(() => wornAs('reddish', 'walls')).toThrow(/walls/)
})
