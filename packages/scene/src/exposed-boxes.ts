import type { BoxPatch, Piece } from './pieces'

type Bounds = { min: number[]; max: number[] }
type Rectangle = { u0: number; u1: number; v0: number; v1: number }
const EPS = 1e-6

export function exposedBoxes(pieces: Piece[]): Piece[] {
  const boxes = pieces.map(boundsOf)
  return pieces.map((piece, index) => {
    const box = boxes[index]
    if (!box || piece.body.kind !== 'box') return piece
    const neighbours = boxes.flatMap((other, j) =>
      other &&
      j !== index &&
      box.min.every(
        (lo, axis) => other.max[axis]! >= lo - EPS && other.min[axis]! <= box.max[axis]! + EPS,
      )
        ? [{ box: other, index: j }]
        : [],
    )
    if (!neighbours.length) return piece
    const patches: BoxPatch[] = []
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3,
        v = (axis + 2) % 3
      for (const sign of [-1, 1]) {
        const plane = sign < 0 ? box.min[axis]! : box.max[axis]!
        let rectangles: Rectangle[] = [
          { u0: box.min[u]!, u1: box.max[u]!, v0: box.min[v]!, v1: box.max[v]! },
        ]
        for (const other of neighbours) {
          const lo = other.box.min[axis]!,
            hi = other.box.max[axis]!
          if (plane < lo - EPS || plane > hi + EPS) continue
          const extendsOut = sign < 0 ? lo < plane - EPS : hi > plane + EPS
          const sameFace = Math.abs((sign < 0 ? lo : hi) - plane) < EPS
          if (!extendsOut && !(sameFace && other.index < index)) continue
          rectangles = rectangles.flatMap((r) =>
            subtract(r, {
              u0: other.box.min[u]!,
              u1: other.box.max[u]!,
              v0: other.box.min[v]!,
              v1: other.box.max[v]!,
            }),
          )
          if (!rectangles.length) break
        }
        for (const r of rectangles) {
          const corners = [
            [r.u0, r.v0],
            [r.u1, r.v0],
            [r.u1, r.v1],
            [r.u0, r.v1],
          ]
          const points = (sign > 0 ? [0, 1, 3] : [0, 3, 1]).map((at) => {
            const point = [0, 0, 0]
            point[axis] = plane
            point[u] = corners[at]![0]!
            point[v] = corners[at]![1]!
            const x = point[0]! - piece.at.x,
              z = point[2]! - piece.at.z
            const c = Math.cos(piece.turn ?? 0),
              s = Math.sin(piece.turn ?? 0)
            return [x * c - z * s, point[1]! - piece.at.y, x * s + z * c] as [
              number,
              number,
              number,
            ]
          })
          patches.push({
            origin: points[0]!,
            u: points[1]!.map((n, i) => n - points[0]![i]!) as [number, number, number],
            v: points[2]!.map((n, i) => n - points[0]![i]!) as [number, number, number],
          })
        }
      }
    }
    return { ...piece, body: { ...piece.body, patches } }
  })
}

function boundsOf(piece: Piece): Bounds | undefined {
  if (piece.body.kind !== 'box' || piece.tilt || piece.roll || (piece.paint.opacity ?? 1) < 1)
    return
  const c = Math.cos(piece.turn ?? 0),
    s = Math.sin(piece.turn ?? 0)
  if (Math.min(Math.abs(c), Math.abs(s)) > EPS) return
  const w = Math.abs(c) * piece.body.width + Math.abs(s) * piece.body.depth
  const d = Math.abs(s) * piece.body.width + Math.abs(c) * piece.body.depth
  return {
    min: [piece.at.x - w / 2, piece.at.y - piece.body.height / 2, piece.at.z - d / 2],
    max: [piece.at.x + w / 2, piece.at.y + piece.body.height / 2, piece.at.z + d / 2],
  }
}

function subtract(r: Rectangle, cut: Rectangle): Rectangle[] {
  const u0 = Math.max(r.u0, cut.u0),
    u1 = Math.min(r.u1, cut.u1)
  const v0 = Math.max(r.v0, cut.v0),
    v1 = Math.min(r.v1, cut.v1)
  if (u1 - u0 <= EPS || v1 - v0 <= EPS) return [r]
  return [
    { ...r, u1: u0 },
    { ...r, u0: u1 },
    { u0, u1, v0: r.v0, v1: v0 },
    { u0, u1, v0: v1, v1: r.v1 },
  ].filter((p) => p.u1 - p.u0 > EPS && p.v1 - p.v0 > EPS)
}
