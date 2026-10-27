import type { HouseDocument } from '@houseit/core/document'
import { type Fence, fenceStretches } from '@houseit/core/fences'
import { floorMaterial } from '@houseit/core/floor-materials'
import { drum, type Finish, type Piece, slab } from './pieces'

type Point = { x: number; y: number }

function shade(hex: string, by: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * (1 + by))))
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`
}

function bar(a: Point, b: Point, base: number, height: number, depth: number, paint: Finish) {
  const run = Math.hypot(b.x - a.x, b.y - a.y)
  return slab({
    x: (a.x + b.x) / 2,
    z: -(a.y + b.y) / 2,
    base,
    w: run,
    d: depth,
    h: height,
    turn: Math.atan2(b.y - a.y, b.x - a.x),
    paint,
  })
}

const POST = { boards: 2000, slats: 2000, mesh: 2500, bars: 2000, gabion: 0, wall: 0 }

function fencePieces(fence: Fence): Piece[] {
  const pieces: Piece[] = []
  const paint: Finish = { colour: fence.colour, roughness: 0.9 }
  const dark: Finish = { colour: shade(fence.colour, -0.25), roughness: 0.6 }
  const height = fence.height
  for (const stretch of fenceStretches(fence)) {
    const { from: a, to: b } = stretch
    const run = Math.hypot(b.x - a.x, b.y - a.y)
    if (run < 1) continue
    const at = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    const turn = Math.atan2(b.y - a.y, b.x - a.x)
    const post = (p: Point, size: number, finish: Finish) =>
      pieces.push(
        fence.kind === 'mesh'
          ? drum({ x: p.x, z: -p.y, r: size / 2, h: height + 50, paint: finish })
          : slab({ x: p.x, z: -p.y, w: size, d: size, h: height + 40, turn, paint: finish }),
      )
    if (stretch.gate) {
      const metal: Finish = { colour: '#2f3236', roughness: 0.45 }
      post(a, 120, metal)
      post(b, 120, metal)
      pieces.push(bar(at(0.03), at(0.97), 80, 50, 50, metal))
      pieces.push(bar(at(0.03), at(0.97), height - 110, 50, 50, metal))
      const bars = Math.max(2, Math.round(run / 110))
      for (let i = 1; i < bars; i++) {
        const p = at(i / bars)
        pieces.push(
          slab({ x: p.x, z: -p.y, base: 130, w: 24, d: 24, h: height - 240, turn, paint: metal }),
        )
      }
      continue
    }
    if (fence.kind === 'wall' || fence.kind === 'gabion') {
      const thick = fence.kind === 'wall' ? 250 : 320
      const stone = floorMaterial('limestone')
      const body: Finish =
        fence.kind === 'gabion' && stone
          ? {
              colour: fence.colour,
              texture: stone.texture,
              repeat: { x: 1000 / stone.unit.width, y: 1000 / stone.unit.depth },
              roughness: 1,
            }
          : paint
      pieces.push(bar(a, b, 0, fence.kind === 'wall' ? height - 60 : height, thick, body))
      if (fence.kind === 'wall') pieces.push(bar(a, b, height - 60, 60, thick + 80, dark))
      continue
    }
    const posts = Math.max(1, Math.ceil(run / POST[fence.kind]))
    if (!stretch.gate)
      for (let i = 0; i <= posts; i++) post(at(i / posts), fence.kind === 'mesh' ? 60 : 90, dark)
    const low = stretch.gate ? 130 : 40
    const high = stretch.gate ? height - 130 : height
    if (fence.kind === 'boards') {
      const boards = Math.max(1, Math.floor((high - low) / 165))
      for (let i = 0; i < boards; i++) pieces.push(bar(a, b, low + i * 165, 140, 24, paint))
    } else if (fence.kind === 'mesh') {
      pieces.push(
        bar(a, b, low, high - low, 6, { colour: fence.colour, opacity: 0.42, roughness: 0.8 }),
      )
      pieces.push(bar(a, b, high - 20, 20, 20, dark))
    } else {
      const slats = fence.kind === 'slats'
      if (!stretch.gate) {
        pieces.push(bar(a, b, slats ? 250 : 100, slats ? 70 : 40, slats ? 40 : 40, dark))
        pieces.push(bar(a, b, high - (slats ? 320 : 140), slats ? 70 : 40, 40, dark))
      }
      const step = slats ? 130 : 120
      const count = Math.max(1, Math.floor(run / step))
      for (let i = 0; i < count; i++) {
        const p = at((i + 0.5) / count)
        pieces.push(
          slab({
            x: p.x,
            z: -p.y,
            base: low,
            w: slats ? 90 : 20,
            d: slats ? 22 : 20,
            h: high - low - (slats ? 0 : 0),
            turn,
            paint: slats ? paint : dark,
          }),
        )
      }
    }
  }
  return pieces
}

export function fencePiecesOf(doc: HouseDocument): Piece[] {
  return Object.values(doc.fences ?? {}).flatMap((fence) =>
    fencePieces(fence).map((piece, index) => ({
      ...piece,
      role: 'site-fence' as const,
      entity: `fences:${fence.id}`,
      name: `fence-${fence.id}-${index}`,
    })),
  )
}
