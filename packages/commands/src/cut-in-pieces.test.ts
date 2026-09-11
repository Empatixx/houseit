import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

const OUTLINES: Record<string, string> = {
  u: 'add-room --material natural-oak --shape u --width 12.6m --depth 10.4m --notch-width 4.2m --notch-depth 5.2m --name dum',
  l: 'add-room --material natural-oak --shape l --width 10m --depth 8m --notch-width 3.5m --notch-depth 4m --name dum',
  t: 'add-room --material natural-oak --shape t --width 12m --depth 9m --bar-depth 3m --stem-width 4m --name dum',
  rectangle: 'add-room --material natural-oak --shape rectangle --width 10m --depth 8m --name dum',
}

const cut = (outline: string, side: string, depth: string) =>
  runScript(
    runScript(createEmptyDocument(), outline),
    `add-room --material beech --from dum --side ${side} --depth ${depth} --name strip`,
  )

const roomNames = (doc: HouseDocument) =>
  roomsOf(doc, Object.keys(doc.levels)[0]!)
    .map((room) => room.name)
    .filter((name) => name !== undefined)
    .sort()

test('one cut never makes two rooms', () => {
  const split: string[] = []
  for (const [shape, outline] of Object.entries(OUTLINES)) {
    for (const side of ['north', 'east', 'south', 'west']) {
      for (const depth of ['1.3m', '2m']) {
        let doc: HouseDocument
        try {
          doc = cut(outline, side, depth)
        } catch (error) {
          const said = error instanceof Error ? error.message : String(error)
          if (!said.startsWith('add-room:')) split.push(`${shape} ${side} ${depth}: ${said}`)
          continue
        }
        const names = roomNames(doc)
        const strips = names.filter((name) => name.startsWith('strip'))
        if (strips.length !== 1) {
          split.push(
            `${shape} ${side} ${depth}: one cut made ${strips.length} rooms — ${names.join(', ')}`,
          )
        }
      }
    }
  }
  expect(split).toEqual([])
})

test('a side that runs straight is still cuttable on every shape', () => {
  const lost: string[] = []
  for (const [shape, outline] of Object.entries(OUTLINES)) {
    const straight = shape === 'rectangle' ? ['north', 'east', 'south', 'west'] : ['south']
    for (const side of straight) {
      try {
        expect(roomNames(cut(outline, side, '1.3m'))).toContain('strip')
      } catch (error) {
        lost.push(`${shape} ${side}: ${error instanceof Error ? error.message : error}`)
      }
    }
  }
  expect(lost).toEqual([])
})
