export type Finish = {
  colour: string
  texture?: string
  repeat?: { x: number; y: number }
  opacity?: number
  roughness?: number
}

export type Corner = { x: number; z: number }

export type Body =
  | { kind: 'box'; width: number; height: number; depth: number }
  | { kind: 'drum'; radius: number; top: number; height: number; open: boolean; stretch: number }
  | { kind: 'ball'; radius: number }
  | { kind: 'prism'; outline: Corner[]; holes: Corner[][]; thickness: number }
  | { kind: 'sheet'; outline: Corner[]; holes: Corner[][] }
  | { kind: 'symbol'; file: string; width: number; depth: number }
  | { kind: 'model'; file: string; width: number; height: number; depth: number }

export type Owner = { kind: 'wall' | 'opening' | 'room' | 'object'; id: string }

export type Piece = {
  body: Body
  at: { x: number; y: number; z: number }
  turn?: number
  tilt?: number
  roll?: number
  paint: Finish
  of?: Owner
  name?: string
}

export const owned = (of: Owner, pieces: Piece[]): Piece[] =>
  pieces.map((piece, index) => ({
    ...piece,
    of: piece.of ?? of,
    name: piece.name ?? `${of.kind}-${of.id}-${index}`,
  }))

export type SlabProps = {
  x?: number
  z?: number
  base?: number
  w: number
  h: number
  d: number
  paint: Finish
  turn?: number
}

export function slab({ x = 0, z = 0, base = 0, w, h, d, paint, turn = 0 }: SlabProps): Piece {
  return {
    body: { kind: 'box', width: w, height: h, depth: d },
    at: { x, y: base + h / 2, z },
    turn,
    paint,
  }
}

export type DrumProps = {
  x?: number
  z?: number
  base?: number
  r: number
  top?: number
  h: number
  paint: Finish
  stretch?: number
  open?: boolean
}

export function drum({
  x = 0,
  z = 0,
  base = 0,
  r,
  top,
  h,
  paint,
  stretch = 1,
  open = false,
}: DrumProps): Piece {
  return {
    body: { kind: 'drum', radius: r, top: top ?? r, height: h, open, stretch },
    at: { x, y: base + h / 2, z },
    paint,
  }
}

export type BallProps = {
  x?: number
  y: number
  z?: number
  r: number
  paint: Finish
}

export function ball({ x = 0, y, z = 0, r, paint }: BallProps): Piece {
  return { body: { kind: 'ball', radius: r }, at: { x, y, z }, paint }
}

export type DiscProps = {
  x?: number
  y: number
  z?: number
  r: number
  thick: number
  paint: Finish
  facing?: 'front' | 'side'
}

export function disc({ x = 0, y, z = 0, r, thick, paint, facing = 'front' }: DiscProps): Piece {
  return {
    body: { kind: 'drum', radius: r, top: r, height: thick, open: false, stretch: 1 },
    at: { x, y, z },
    tilt: facing === 'front' ? Math.PI / 2 : 0,
    roll: facing === 'front' ? 0 : Math.PI / 2,
    paint,
  }
}

export type LeanProps = {
  x?: number
  from: [number, number]
  to: [number, number]
  w: number
  thick: number
  paint: Finish
}

export function lean({ x = 0, from, to, w, thick, paint }: LeanProps): Piece {
  const dz = to[0] - from[0]
  const dy = to[1] - from[1]
  return {
    body: { kind: 'box', width: w, height: Math.hypot(dz, dy), depth: thick },
    at: { x, y: (from[1] + to[1]) / 2, z: (from[0] + to[0]) / 2 },
    tilt: Math.atan2(dz, dy),
    paint,
  }
}

export const along = (count: number, at: (i: number) => number): number[] =>
  Array.from({ length: count }, (_, i) => at(i))

export type LegsProps = {
  w: number
  d: number
  h: number
  inset?: number
  thick?: number
  paint: Finish
  x?: number
  z?: number
}

export function legs({ w, d, h, inset = 60, thick = 50, paint, x = 0, z = 0 }: LegsProps): Piece[] {
  const dx = w / 2 - inset - thick / 2
  const dz = d / 2 - inset - thick / 2
  return [-dx, dx].flatMap((lx) =>
    [-dz, dz].map((lz) => slab({ x: x + lx, z: z + lz, h, w: thick, d: thick, paint })),
  )
}

export type PutProps = { x?: number; y?: number; z?: number; turn?: number }

export function put({ x = 0, y = 0, z = 0, turn = 0 }: PutProps, pieces: Piece[]): Piece[] {
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  return pieces.map((piece) => ({
    ...piece,
    at: {
      x: x + piece.at.x * cos + piece.at.z * sin,
      y: y + piece.at.y,
      z: z - piece.at.x * sin + piece.at.z * cos,
    },
    turn: turn + (piece.turn ?? 0),
  }))
}

export type PrismProps = {
  x?: number
  z?: number
  base?: number
  outline: Corner[]
  holes?: Corner[][]
  thickness: number
  paint: Finish
}

export function prism({
  x = 0,
  z = 0,
  base = 0,
  outline,
  holes = [],
  thickness,
  paint,
}: PrismProps): Piece {
  return {
    body: { kind: 'prism', outline, holes, thickness },
    at: { x, y: base + thickness / 2, z },
    paint,
  }
}

export type ModelProps = {
  file: string
  w: number
  h: number
  d: number
  paint: Finish
}

export function model({ file, w, h, d, paint }: ModelProps): Piece {
  return {
    body: { kind: 'model', file, width: w, height: h, depth: d },
    at: { x: 0, y: h / 2, z: 0 },
    paint,
  }
}

export type SheetProps = {
  base?: number
  outline: Corner[]
  holes?: Corner[][]
  paint: Finish
}

export function sheet({ base = 0, outline, holes = [], paint }: SheetProps): Piece {
  return { body: { kind: 'sheet', outline, holes }, at: { x: 0, y: base, z: 0 }, paint }
}
