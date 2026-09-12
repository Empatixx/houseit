import { expect, test } from 'vitest'
import { exposedSlabTop } from './slab-top'

const rectangle = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
]

test('an upper floor removes only its covered slab top, retaining the lower roof and shaft holes', () => {
  const top = exposedSlabTop({ outline: rectangle(0, 0, 8, 6), holes: [rectangle(6, 2, 7, 3)] }, [
    { outline: rectangle(0, 0, 4, 6), holes: [rectangle(1, 2, 2, 3)] },
  ])!
  const area = top.reduce((sum, r) => sum + (r[1]!.x - r[0]!.x) * (r[2]!.z - r[0]!.z), 0)
  expect(area).toBeCloseTo(24)
  expect(top.some((r) => r[0]!.x === 1 && r[0]!.z === 2)).toBe(true)
  expect(top.some((r) => r[0]!.x === 6 && r[0]!.z === 2)).toBe(false)
})

test('a fully covered slab has no upward face competing with the finish', () => {
  const surface = { outline: rectangle(0, 0, 4, 6), holes: [] }
  expect(exposedSlabTop(surface, [surface])).toEqual([])
})
