export type Point = { x: number; y: number }

/**
 * The shapes a floor can start as. Plans are drawn with +y pointing north, so
 * `depth` runs north–south and `width` east–west, with the origin at the
 * south-west corner.
 */
export type OutlineSpec =
  | { kind: 'rectangle'; width: number; depth: number }
  | {
      kind: 'l'
      width: number
      depth: number
      /** Bite taken out of the north-east corner. */
      notchWidth: number
      notchDepth: number
    }
  | { kind: 'u'; width: number; depth: number; notchWidth: number; notchDepth: number }
  | { kind: 't'; width: number; depth: number; barDepth: number; stemWidth: number }

export type OutlineKind = OutlineSpec['kind']

export const OUTLINE_KINDS: OutlineKind[] = ['rectangle', 'l', 'u', 't']

class OutlineError extends Error {}

function require(condition: boolean, message: string): void {
  if (!condition) throw new OutlineError(message)
}

/**
 * Corner points of a floor outline, counter-clockwise so that face detection
 * reads the enclosed area as positive.
 */
export function outlinePoints(spec: OutlineSpec): Point[] {
  require(spec.width > 0 && spec.depth > 0, 'the building must have a positive size')
  const { width: w, depth: d } = spec

  if (spec.kind === 'rectangle') {
    return [p(0, 0), p(w, 0), p(w, d), p(0, d)]
  }

  if (spec.kind === 'l') {
    const { notchWidth: nw, notchDepth: nd } = spec
    require(nw > 0 && nw < w, 'the notch must be narrower than the building')
    require(nd > 0 && nd < d, 'the notch must be shallower than the building')
    return [p(0, 0), p(w, 0), p(w, d - nd), p(w - nw, d - nd), p(w - nw, d), p(0, d)]
  }

  if (spec.kind === 'u') {
    const { notchWidth: nw, notchDepth: nd } = spec
    require(nw > 0 && nw < w, 'the notch must be narrower than the building')
    require(nd > 0 && nd < d, 'the notch must be shallower than the building')
    const left = Math.round((w - nw) / 2)
    const right = left + nw
    return [
      p(0, 0),
      p(w, 0),
      p(w, d),
      p(right, d),
      p(right, d - nd),
      p(left, d - nd),
      p(left, d),
      p(0, d),
    ]
  }

  const { barDepth: bd, stemWidth: sw } = spec
  require(bd > 0 && bd < d, 'the bar must be shallower than the building')
  require(sw > 0 && sw < w, 'the stem must be narrower than the building')
  const left = Math.round((w - sw) / 2)
  const right = left + sw
  return [
    p(left, 0),
    p(right, 0),
    p(right, d - bd),
    p(w, d - bd),
    p(w, d),
    p(0, d),
    p(0, d - bd),
    p(left, d - bd),
  ]
}

const p = (x: number, y: number): Point => ({ x, y })
