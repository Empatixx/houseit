import { expect, test } from 'vitest'
import { clearOf } from '../store/view'
import { coverOf } from './use-cover'

const bar = (size: { width: number; height: number }, top: number) =>
  ({
    offsetWidth: size.width,
    offsetHeight: size.height,
    offsetTop: top,
    offsetLeft: 0,
    offsetParent: { clientWidth: 1414, clientHeight: 874 },
  }) as unknown as HTMLElement

test('a bar along the foot covers the height of itself, not of the canvas', () => {
  expect(coverOf(bar({ width: 430, height: 46 }, 812), 'bottom')).toEqual({
    edge: 'bottom',
    extent: 62,
  })
})

test('an element with no size yet hides nothing, rather than hiding everything', () => {
  expect(coverOf(bar({ width: 0, height: 0 }, 0), 'bottom')).toBeNull()
})

test('and so the whole canvas is still there to frame a plan in', () => {
  const canvas = { width: 1414, height: 874 }
  const unmeasured = coverOf(bar({ width: 0, height: 0 }, 0), 'bottom')

  expect(clearOf(unmeasured ? { bar: unmeasured } : {}, canvas)).toEqual({
    x: 0,
    y: 0,
    ...canvas,
  })
})
