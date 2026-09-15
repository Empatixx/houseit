import type { Opening, Wall } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { INK, lineWeight, planPieces, solidPieces } from './wall-pieces'

const wall: Wall = {
  id: 'w1',
  level: 'l1',
  a: 'n1',
  b: 'n2',
  thickness: 300,
  baseOffset: 0,
  height: 2800,
}

const window_: Opening = {
  id: 'o1',
  wall: 'w1',
  t: 0.5,
  kind: 'window',
  variant: 'hinged',
  width: 1200,
  height: 1500,
  sillHeight: 900,
  hinge: 'a',
  swing: 1,
}

const plan = (openings: Opening[]) => planPieces(wall, openings, 6000, 0, 6000)

test('a blank wall is an outline with the fill sitting inside it', () => {
  const pieces = plan([])

  expect(pieces).toEqual([
    {
      key: 'outline-0',
      colour: INK.outline,
      at: 3000,
      length: 6000,
      thickness: 300,
      base: 0,
      height: 2800,
    },
    {
      key: 'fill-0',
      colour: INK.wall,
      at: 3000,
      length: 6000,
      thickness: 300 - 2 * 38,
      base: 2,
      height: 2800,
    },
  ])
})

test('the fill stops either side of an opening', () => {
  const fills = plan([window_]).filter((piece) => piece.key.startsWith('fill-'))

  expect(fills.map((piece) => piece.length)).toEqual([2400, 2400])
})

test('an opening is white with a line down the middle of it, drawn over the white', () => {
  const pieces = plan([window_])
  const glass = pieces.find((piece) => piece.key === 'o1-glass')!
  const pane = pieces.find((piece) => piece.key === 'o1-pane')!

  expect(glass.colour).toBe(INK.glass)
  expect(pane.colour).toBe(INK.outline)
  expect(pane.thickness).toBe(lineWeight(300))
  expect(pane.base).toBeGreaterThan(glass.base)
})

test('the outline runs across a window, so the wall shows at its faces', () => {
  const outline = plan([window_]).find((piece) => piece.key === 'outline-0')!

  expect(outline).toMatchObject({ length: 6000, thickness: 300, base: 0 })
})

test('a thin partition still gets a line it can be seen at', () => {
  expect(lineWeight(150)).toBe(19)
  expect(lineWeight(80)).toBe(15)
})

test('in perspective a wall is the stretches between its openings, at full thickness', () => {
  const pieces = solidPieces(wall, [window_], 6000, 0, 6000)
  const full = pieces.filter((piece) => piece.height === wall.height)

  expect(full.map((piece) => piece.length)).toEqual([2400, 2400])
  expect(pieces.every((piece) => piece.thickness === 300)).toBe(true)
})

test('in perspective a window keeps the sill below it and the head above it', () => {
  const pieces = solidPieces(wall, [window_], 6000, 0, 6000)
  const overWindow = pieces.filter((piece) => piece.length === window_.width)

  expect(overWindow.map((piece) => [piece.base, piece.height])).toEqual([
    [0, 900],
    [2400, 400],
  ])
})

test('a window reaching the ceiling gets no head', () => {
  const full: Opening = { ...window_, sillHeight: 900, height: 1900 }
  const pieces = solidPieces(wall, [full], 6000, 0, 6000)

  expect(pieces.filter((piece) => piece.length === full.width)).toHaveLength(1)
})

const door: Opening = {
  id: 'd1',
  wall: 'w1',
  t: 0.5,
  kind: 'door',
  variant: 'hinged',
  width: 800,
  height: 1970,
  sillHeight: 0,
  hinge: 'a',
  swing: 1,
}

test('a doorway is left open, so the floors of the two rooms meet in it', () => {
  const keys = plan([door]).map((piece) => piece.key)

  expect(keys).not.toContain('d1-glass')
  expect(keys).not.toContain('d1-pane')

  const inTheGap = plan([door]).filter(
    (piece) => !piece.key.startsWith('d1-') && Math.abs(piece.at - 3000) < door.width / 2,
  )
  expect(inTheGap).toEqual([])
})

test('the wall each side of a doorway is outlined, so the jambs show', () => {
  const outlines = plan([door]).filter((piece) => piece.key.startsWith('outline-'))

  expect(outlines.map((piece) => piece.length)).toEqual([2600, 2600])
  expect(outlines.every((piece) => piece.thickness === 300)).toBe(true)
})

test('the leaf stands square to the wall, on the side the door swings to', () => {
  const leaf = plan([door]).find((piece) => piece.key === 'd1-leaf')!

  expect(leaf.length).toBe(door.width + wall.thickness)
  expect(leaf.turn).toBeCloseTo(Math.PI / 2)
  expect(leaf.aside).toBeCloseTo(door.width / 2)
})

test('the leaf starts at the far face, so it stands in the doorway and not against it', () => {
  const leaf = plan([door]).find((piece) => piece.key === 'd1-leaf')!
  const face = wall.thickness / 2

  expect(leaf.aside! - leaf.length / 2).toBeCloseTo(-face)
  expect(leaf.aside! + leaf.length / 2).toBeCloseTo(face + door.width)
})

test('a door swinging the other way puts its leaf on the other side', () => {
  const leaf = plan([{ ...door, swing: -1 }]).find((piece) => piece.key === 'd1-leaf')!

  expect(leaf.aside).toBeCloseTo(-door.width / 2)
})

test('the swing is dashed, from the open leaf round to the far jamb', () => {
  const dashes = plan([door]).filter((piece) => piece.key.startsWith('d1-arc-'))
  const first = dashes[0]!
  const last = dashes[dashes.length - 1]!

  expect(dashes.length).toBeGreaterThan(3)
  expect(first.aside).toBeCloseTo(wall.thickness / 2 + door.width, -2)
  expect(last.aside).toBeCloseTo(wall.thickness / 2, -2)
})

test('hanging the leaf on the other end swings the arc the other way along the wall', () => {
  const at = (hinge: 'a' | 'b') =>
    plan([{ ...door, hinge }]).find((piece) => piece.key === 'd1-leaf')!.at

  expect(at('a')).toBeLessThan(at('b'))
})

test('a window keeps its pane line and grows no leaf', () => {
  const keys = plan([window_]).map((piece) => piece.key)

  expect(keys).toContain('o1-pane')
  expect(keys.some((key) => key.includes('leaf') || key.includes('arc'))).toBe(false)
})

test('the leaf is drawn half as thick as the wall, white between two lines', () => {
  const pieces = plan([door])
  const leaf = pieces.find((piece) => piece.key === 'd1-leaf')!
  const fill = pieces.find((piece) => piece.key === 'd1-leaf-fill')!

  expect(leaf.thickness).toBe(wall.thickness / 2)
  expect(leaf.colour).toBe(INK.outline)
  expect(fill.colour).toBe(INK.glass)
  expect(fill.thickness).toBe(leaf.thickness - 2 * lineWeight(wall.thickness))
  expect(fill.length).toBe(leaf.length - 2 * lineWeight(wall.thickness))
})

test('the leaf sits inside the opening, its outer face flush with the jamb', () => {
  const leaf = plan([door]).find((piece) => piece.key === 'd1-leaf')!
  expect(leaf.at - leaf.thickness / 2).toBeCloseTo(2600)
})

test('the swing is a quarter circle as wide as the door, the way the reference draws it', () => {
  const dashes = plan([door]).filter((piece) => piece.key.startsWith('d1-arc-'))
  const line = lineWeight(wall.thickness)
  const face = wall.thickness / 2
  const radius = door.width - line / 2

  for (const dash of dashes) {
    expect(Math.hypot(dash.at - 2600, dash.aside! - face)).toBeCloseTo(radius)
  }
})

test('both unequal door leaves and their hit areas belong to the real opening', () => {
  const door: Opening = {
    ...window_,
    kind: 'door',
    width: 1600,
    leafWidth: 1000,
    sillHeight: 0,
    height: 2100,
  }
  const pieces = plan([door]).filter((p) => p.key.startsWith('o1-'))
  expect(pieces.some((p) => p.key.includes('-leaf-a-'))).toBe(true)
  expect(pieces.some((p) => p.key.includes('-leaf-b-'))).toBe(true)
  expect(pieces.every((p) => p.opening === door.id)).toBe(true)
  expect(new Set(pieces.map((p) => p.key)).size).toBe(pieces.length)
})

test('the edge of a paved surface is one thin line, and nothing is cut into it', () => {
  const pieces = planPieces(wall, [window_], 6000, 0, 6000, undefined, 'edge')

  expect(pieces).toHaveLength(1)
  expect(pieces[0]!.thickness).toBe(lineWeight(wall.thickness))
  expect(pieces[0]!.length).toBe(6000)
})

test('a glazed wall is drawn the way a window is, the whole way along', () => {
  const pieces = planPieces(wall, [], 6000, 0, 6000, undefined, 'glass')

  expect(pieces.map((piece) => piece.colour)).toEqual([INK.outline, INK.glass, INK.outline])
  expect(pieces[2]!.thickness).toBe(lineWeight(wall.thickness))
})
