import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const HOUSE = [
  'add-room --material natural-oak --shape rectangle --width 10m --depth 8m --name dům',
  'add-opening --kind door --room dům --side north',
].join('\n')

test('a fence round the house gets its gate opposite the front door', () => {
  const doc = runScript(createEmptyDocument(), `${HOUSE}\nadd-fence --kind boards --around 5m`)
  const fence = doc.fences!.g1!
  expect(fence.closed).toBe(true)
  expect(fence.points).toHaveLength(4)
  const gate = fence.gates[0]!
  expect(gate.width).toBe(1200)
  const north = fence.points[2]!.y
  const along = fence.points[1]!.x - fence.points[0]!.x + fence.points[2]!.y - fence.points[1]!.y
  expect(gate.at).toBeGreaterThan(along)
  expect(north).toBeGreaterThan(8000)
  const again = runScript(doc, 'update-fence --id g1 --kind mesh --gates []')
  expect(again.fences!.g1).toMatchObject({ kind: 'mesh', gates: [] })
  expect(runScript(again, 'remove-fence --id g1').fences).toBeUndefined()
})

test('the answer reads the fence back with its length', () => {
  const answer = askPlan(createEmptyDocument(), `${HOUSE}\nadd-fence --kind slats --around 5m`)
  expect(answer.fences?.[0]).toMatchObject({
    id: 'g1',
    label: 'vertical slat fence',
    gates: [expect.objectContaining({ width: 1200 })],
  })
  expect(answer.fences![0]!.length).toBeGreaterThan(70_000)
})

test('a gate that does not fit the fence is refused', () => {
  expect(() =>
    runScript(
      createEmptyDocument(),
      `${HOUSE}\nadd-fence --kind bars --points '[{"x":0,"y":-3000},{"x":4000,"y":-3000}]' --gates '[{"at":3500,"width":1200}]'`,
    ),
  ).toThrow(/does not fit/)
})
