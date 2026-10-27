import { expect, test } from 'vitest'
import { ifcGuidOf } from './ifc-guid'

test('a key always gives the same 22 character IFC GUID, and different keys differ', () => {
  const guid = ifcGuidOf('rooms:r1')
  expect(guid).toMatch(/^[0-3][0-9A-Za-z_$]{21}$/)
  expect(ifcGuidOf('rooms:r1')).toBe(guid)
  const many = new Set(Array.from({ length: 2000 }, (_, i) => ifcGuidOf(`objects:f${i}`)))
  expect(many.size).toBe(2000)
})
