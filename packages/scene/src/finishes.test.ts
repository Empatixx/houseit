import { surfaceOf } from '@houseit/core/surfaces'
import { expect, test } from 'vitest'
import { lighter, PAINT, paintOf } from './finishes'

test('a grained surface names the photo it wears and the tint under it', () => {
  const oak = paintOf(surfaceOf('oak')!)

  expect(oak.body).toEqual({ colour: '#f3e4c9', texture: '/finishes/oak-light.jpg' })
})

test('a surface with no grain is the colour it is drawn in and wears no photo', () => {
  const green = paintOf(surfaceOf('green')!)

  expect(green.body).toEqual({ colour: '#8ba57d' })
  expect(green.frame).toEqual({ colour: '#546b49' })
})

test('the texture is named, not loaded, because naming it is all a description can do', () => {
  expect(paintOf(surfaceOf('walnut')!).body.texture).toBe('/finishes/oak-light.jpg')
})

test('lighter moves a colour towards white and leaves the rest of the finish alone', () => {
  const lit = lighter(
    { colour: '#000000', texture: 'surfaces/marble-white.svg', opacity: 0.4 },
    0.5,
  )

  expect(lit).toEqual({ colour: '#808080', texture: 'surfaces/marble-white.svg', opacity: 0.4 })
})

test('every named paint is a colour somebody can read', () => {
  for (const [name, paint] of Object.entries(PAINT)) {
    expect(paint.colour, name).toMatch(/^#[0-9a-f]{6}$/)
  }
})
