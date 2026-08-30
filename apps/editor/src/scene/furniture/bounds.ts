import type { Part } from './skeleton'

export type Bounds = { width: number; depth: number }

/**
 * The box a thing actually takes up on the floor, turned parts and all.
 *
 * Worth its own function because measuring it by eye gets it wrong: a part turned
 * on its side swaps which of its dimensions runs which way, and a fringe strand
 * measured as if it were upright makes a rug look 84 mm deeper than it is. That
 * mistake once sent a search for a bug that was not there.
 */
export function boundsOf(parts: Part[]): Bounds {
  let x = 0
  let y = 0

  for (const part of parts) {
    const turn = part.turn ?? 0
    const cos = Math.abs(Math.cos(turn))
    const sin = Math.abs(Math.sin(turn))
    const half =
      part.kind === 'disc'
        ? { x: part.width / 2, y: part.depth / 2 }
        : {
            x: (part.width / 2) * cos + (part.depth / 2) * sin,
            y: (part.width / 2) * sin + (part.depth / 2) * cos,
          }

    x = Math.max(x, Math.abs(part.x) + half.x)
    y = Math.max(y, Math.abs(part.y) + half.y)
  }

  return { width: x * 2, depth: y * 2 }
}
