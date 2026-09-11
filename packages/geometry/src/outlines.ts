export type Point = { x: number; y: number }

export type OutlineSpec =
  | { kind: 'rectangle'; width: number; depth: number }
  | {
      kind: 'l'
      width: number
      depth: number
      notchWidth: number
      notchDepth: number
    }
  | { kind: 'u'; width: number; depth: number; notchWidth: number; notchDepth: number }
  | { kind: 't'; width: number; depth: number; barDepth: number; stemWidth: number }

export type OutlineKind = OutlineSpec['kind']

class OutlineError extends Error {}

function require(condition: boolean, message: string): void {
  if (!condition) throw new OutlineError(message)
}

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

export type Leg = { heading: 'n' | 's' | 'e' | 'w'; length: number }

const HEADINGS = {
  n: { x: 0, y: 1 },
  s: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
} as const

export function walkPoints(legs: Leg[]): Point[] {
  require(legs.length >= 3, 'a building needs at least three sides')

  const points: Point[] = [p(0, 0)]
  for (const leg of legs) {
    require(leg.length > 0, 'every leg of the walk has to go somewhere')
    const step = HEADINGS[leg.heading]
    const last = points[points.length - 1]!
    points.push(p(last.x + step.x * leg.length, last.y + step.y * leg.length))
  }

  const end = points[points.length - 1]!
  require(end.x === 0 ||
    end.y === 0, 'the walk does not close: from where it ends, home is not a straight line')
  if (end.x === 0 && end.y === 0) points.pop()

  const area = shoelace(points)
  require(area !== 0, 'the walk encloses nothing')
  return area > 0 ? points : points.reverse()
}

function shoelace(points: Point[]): number {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    total += a.x * b.y - b.x * a.y
  }
  return total / 2
}
