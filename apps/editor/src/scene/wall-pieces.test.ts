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
  const fills = plan([window_]).filter((piece) => piece.colour === INK.wall)

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
  width: 800,
  height: 1970,
  sillHeight: 0,
  hinge: 'a',
  swing: 1,
}

test('a doorway is left open, so the floors of the two rooms meet in it', () => {
  const keys = plan([door]).map((piece) => piece.key)

  // Nothing at all is drawn across the gap — no white, and no outline either.
  // Both rooms' floors reach the middle of the wall, so a doorway filled in with
  // anything is a doorway with a white slab lying in it.
  expect(keys).not.toContain('d1-glass')
  expect(keys).not.toContain('d1-pane')

  // Nothing belonging to the wall itself is left standing in the gap.
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

  expect(leaf.length).toBe(door.width)
  expect(leaf.turn).toBeCloseTo(Math.PI / 2)
  // Hung at the far edge of the opening, so the leaf crosses the reveal.
  expect(leaf.aside).toBeCloseTo(door.width / 2 - wall.thickness / 2)
})

test('a door swinging the other way puts its leaf on the other side', () => {
  const leaf = plan([{ ...door, swing: -1 }]).find((piece) => piece.key === 'd1-leaf')!

  expect(leaf.aside).toBeCloseTo(-(door.width / 2 - wall.thickness / 2))
})

test('the swing is dashed, from the open leaf round to the far jamb', () => {
  const dashes = plan([door]).filter((piece) => piece.key.startsWith('d1-arc-'))
  const first = dashes[0]!
  const last = dashes[dashes.length - 1]!

  expect(dashes.length).toBeGreaterThan(3)
  // It leaves the tip of the open leaf and comes back to the face it hangs on.
  expect(first.aside).toBeCloseTo(door.width - wall.thickness / 2, -2)
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
  // The door is centred, so its opening runs 2600..3400 of the 6000 wall.
  expect(leaf.at - leaf.thickness / 2).toBeCloseTo(2600)
})

test('the drawn edge of the swing lands on the corners, not the middle of the line', () => {
  const pieces = plan([door])
  const leaf = pieces.find((piece) => piece.key === 'd1-leaf')!
  const dashes = pieces.filter((piece) => piece.key.startsWith('d1-arc-'))
  const line = lineWeight(wall.thickness)
  const face = wall.thickness / 2

  // The quarter is an ellipse from the leaf corner facing the opening to the near
  // face of the far jamb, both semi-axes short by half a line so the line's edge
  // meets the corners. Every dash sits on it.
  const reach = door.width - leaf.thickness - line / 2
  const rise = door.width - 2 * face - line / 2

  for (const dash of dashes) {
    const along = (dash.at - (2600 + leaf.thickness)) / reach
    const across = (dash.aside! - face) / rise
    expect(Math.hypot(along, across)).toBeCloseTo(1)
  }
})
