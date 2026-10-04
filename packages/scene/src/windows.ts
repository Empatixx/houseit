import type { Wall } from '@houseit/core/document'
import type { OpeningPart } from '@houseit/core/opening-parts'
import type { StandingPiece } from './doors'

export const WINDOW_PAINT = {
  frame: '#f4f3f0',
  handle: '#d9d9d6',
  board: '#f4f3f0',
  flashing: '#9aa0a4',
} as const

const FRAME = { face: 68, depth: 80 }
const SASH = { face: 58, depth: 70 }
const MULLION = 80
const GLASS = 24
const TWO_SASHES = 1300
const SETBACK = 60
const OVERHANG = 40

export function windowPieces(
  opening: OpeningPart,
  wall: Wall,
  centre: number,
  outside?: -1 | 1,
): StandingPiece[] {
  if (opening.kind !== 'window' || opening.frame) return []
  const { width, height, sillHeight: sill } = opening
  const inner = outside ? -outside : 1
  const set = Math.max(0, wall.thickness / 2 - SETBACK - FRAME.depth / 2)
  const plane = outside ? outside * set : 0
  const piece = (
    key: string,
    at: number,
    base: number,
    length: number,
    tall: number,
    aside: number,
    thickness: number,
    colour: string = WINDOW_PAINT.frame,
    takesFinish = colour === WINDOW_PAINT.frame,
  ): StandingPiece => ({
    key: `${opening.id}-${key}`,
    at,
    aside,
    turn: 0,
    length,
    height: tall,
    thickness,
    base,
    colour,
    ...(takesFinish ? { takesFinish } : {}),
  })

  const left = centre - width / 2
  const right = centre + width / 2
  const pieces: StandingPiece[] = [
    piece('frame-a', left + FRAME.face / 2, sill, FRAME.face, height, plane, FRAME.depth),
    piece('frame-b', right - FRAME.face / 2, sill, FRAME.face, height, plane, FRAME.depth),
    piece(
      'frame-head',
      centre,
      sill + height - FRAME.face,
      width - 2 * FRAME.face,
      FRAME.face,
      plane,
      FRAME.depth,
    ),
    piece('frame-sill', centre, sill, width - 2 * FRAME.face, FRAME.face, plane, FRAME.depth),
  ]

  const clear = { from: left + FRAME.face, to: right - FRAME.face }
  const two = width > TWO_SASHES
  if (two)
    pieces.push(
      piece(
        'mullion',
        centre,
        sill + FRAME.face,
        MULLION,
        height - 2 * FRAME.face,
        plane,
        FRAME.depth,
      ),
    )
  const sashes = two
    ? [
        { from: clear.from, to: centre - MULLION / 2, latch: 1 },
        { from: centre + MULLION / 2, to: clear.to, latch: -1 },
      ]
    : [{ from: clear.from, to: clear.to, latch: 1 }]
  const sashPlane = plane + (inner * (FRAME.depth - SASH.depth)) / 2 + inner * 6
  const low = sill + FRAME.face
  const tall = height - 2 * FRAME.face
  sashes.forEach((sash, n) => {
    const span = sash.to - sash.from
    const mid = (sash.from + sash.to) / 2
    const name = `sash-${n + 1}`
    pieces.push(
      piece(
        `${name}-stile-a`,
        sash.from + SASH.face / 2,
        low,
        SASH.face,
        tall,
        sashPlane,
        SASH.depth,
      ),
      piece(
        `${name}-stile-b`,
        sash.to - SASH.face / 2,
        low,
        SASH.face,
        tall,
        sashPlane,
        SASH.depth,
      ),
      piece(
        `${name}-rail-head`,
        mid,
        low + tall - SASH.face,
        span - 2 * SASH.face,
        SASH.face,
        sashPlane,
        SASH.depth,
      ),
      piece(`${name}-rail-sill`, mid, low, span - 2 * SASH.face, SASH.face, sashPlane, SASH.depth),
      piece(
        `${name}-glass`,
        mid,
        low + SASH.face - 8,
        span - 2 * SASH.face + 16,
        tall - 2 * SASH.face + 16,
        sashPlane,
        GLASS,
        WINDOW_PAINT.frame,
        false,
      ),
    )
    const latch = sash.latch > 0 ? sash.to - SASH.face / 2 : sash.from + SASH.face / 2
    const grip = Math.min(low + tall / 2, sill + 1100)
    const face = sashPlane + (inner * SASH.depth) / 2
    pieces.push(
      piece(
        `${name}-handle-rose`,
        latch,
        grip - 40,
        30,
        80,
        face + inner * 6,
        12,
        WINDOW_PAINT.handle,
      ),
      piece(
        `${name}-handle`,
        latch,
        grip - 115,
        22,
        110,
        face + inner * 26,
        18,
        WINDOW_PAINT.handle,
      ),
    )
  })

  if (sill > 0) {
    const frameInside = plane + (inner * FRAME.depth) / 2
    const roomFace = inner * (wall.thickness / 2 + OVERHANG)
    const deep = Math.abs(roomFace - frameInside)
    if (deep > 10)
      pieces.push(
        piece(
          'board',
          centre,
          sill - 5,
          width + 2 * OVERHANG,
          25,
          (roomFace + frameInside) / 2,
          deep,
          WINDOW_PAINT.board,
          false,
        ),
      )
    if (outside) {
      const frameOutside = plane + (outside * FRAME.depth) / 2
      const weatherFace = outside * (wall.thickness / 2 + OVERHANG)
      const reach = Math.abs(weatherFace - frameOutside)
      if (reach > 10)
        pieces.push(
          piece(
            'flashing',
            centre,
            sill - 3,
            width + 2 * 20,
            18,
            (weatherFace + frameOutside) / 2,
            reach,
            WINDOW_PAINT.flashing,
            false,
          ),
        )
    }
  }
  return pieces
}
