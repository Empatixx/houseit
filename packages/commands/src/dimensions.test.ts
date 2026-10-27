import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { runScript } from './run'

test('a dimension is drawn on one view and taken off by its id', () => {
  const doc = runScript(
    createEmptyDocument(),
    `add-dimension --view south --from '{"x":0,"y":0,"z":0}' --to '{"x":"4.2m","y":0,"z":0}' --offset 800`,
  )
  expect(doc.dimensions).toEqual({
    d1: {
      id: 'd1',
      view: 'south',
      from: { x: 0, y: 0, z: 0 },
      to: { x: 4200, y: 0, z: 0 },
      offset: 800,
    },
  })
  expect(runScript(doc, 'remove-dimension --id d1').dimensions).toBeUndefined()
})

test('a dimension between one point and itself is refused', () => {
  expect(() =>
    runScript(
      createEmptyDocument(),
      `add-dimension --view north --from '{"x":1,"y":2,"z":3}' --to '{"x":1,"y":2,"z":3}'`,
    ),
  ).toThrow(/same point/)
})
