import { createEmptyDocument } from '@houseit/core/document'
import { roomLabel } from '@houseit/geometry/room-label'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

test('a narrow WC label fits between its open door leaf and north pipe casing', () => {
  const doc = runScript(
    createEmptyDocument(),
    `
update-level --name Ground
add-room --name WC --material ceramic-tile --boundary '[{"x":0,"y":0,"thickness":125},{"x":1175,"y":0,"thickness":125},{"x":1175,"y":2300,"thickness":125},{"x":0,"y":2300,"thickness":125}]'
add-shaft --to Ground --kind services --x 588 --y 2088 --width 1050 --depth 300 --enclosure '{"thickness":125,"colour":"#d9d7d2"}'
add-opening --room WC --kind door --side west --width 700 --height 1970 --along 575 --hinge right
`,
  )
  const level = Object.keys(doc.levels)[0]!
  const room = roomsOf(doc, level)[0]!
  const label = roomLabel(doc, level, room)
  // The north-hinged open leaf crosses the WC at y=987.5; its casing ends at1813.
  expect(label.y - label.height / 2).toBeGreaterThan(987.5)
  expect(label.y + label.height / 2).toBeLessThanOrEqual(1813)
  expect(label.width).toBeGreaterThanOrEqual(1000)
  expect(label.height).toBeGreaterThan(500)
})
