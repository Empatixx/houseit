import type { Point } from './outlines'

export type Box = { x0: number; y0: number; x1: number; y1: number }

export function unionOfBoxes(boxes: Box[]): Point[][] {
  if (boxes.length === 0) return []
  const xs = [...new Set(boxes.flatMap((box) => [box.x0, box.x1]))].sort((a, b) => a - b)
  const ys = [...new Set(boxes.flatMap((box) => [box.y0, box.y1]))].sort((a, b) => a - b)

  const covered = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false
    const x = (xs[i]! + xs[i + 1]!) / 2
    const y = (ys[j]! + ys[j + 1]!) / 2
    return boxes.some((box) => box.x0 < x && x < box.x1 && box.y0 < y && y < box.y1)
  }

  type Edge = { from: Point; to: Point }
  const edges: Edge[] = []
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      if (!covered(i, j)) continue
      const [x0, x1, y0, y1] = [xs[i]!, xs[i + 1]!, ys[j]!, ys[j + 1]!]
      if (!covered(i, j - 1)) edges.push({ from: { x: x0, y: y0 }, to: { x: x1, y: y0 } })
      if (!covered(i + 1, j)) edges.push({ from: { x: x1, y: y0 }, to: { x: x1, y: y1 } })
      if (!covered(i, j + 1)) edges.push({ from: { x: x1, y: y1 }, to: { x: x0, y: y1 } })
      if (!covered(i - 1, j)) edges.push({ from: { x: x0, y: y1 }, to: { x: x0, y: y0 } })
    }
  }

  const key = (point: Point) => `${point.x},${point.y}`
  const leaving = new Map<string, Edge[]>()
  for (const edge of edges) {
    const from = key(edge.from)
    leaving.set(from, [...(leaving.get(from) ?? []), edge])
  }

  const rings: Point[][] = []
  const walked = new Set<Edge>()
  for (const first of edges) {
    if (walked.has(first)) continue
    const ring: Point[] = []
    let edge: Edge | undefined = first
    while (edge && !walked.has(edge)) {
      walked.add(edge)
      ring.push(edge.from)
      edge = leaving.get(key(edge.to))?.find((candidate) => !walked.has(candidate))
    }
    rings.push(straightened(ring))
  }
  return rings
}

function straightened(ring: Point[]): Point[] {
  return ring.filter((point, index) => {
    const before = ring[(index + ring.length - 1) % ring.length]!
    const after = ring[(index + 1) % ring.length]!
    const alongX = before.x === point.x && point.x === after.x
    const alongY = before.y === point.y && point.y === after.y
    return !alongX && !alongY
  })
}
