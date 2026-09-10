import { finishOf } from '@houseit/core/finishes'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint } from '@houseit/geometry/rooms'
import type { Finish } from './pieces'

const PROBE = 50

const COLOUR = /^#[0-9a-f]{6}$/i

const COVERS: Record<string, { width: number; height: number }> = {
  brick: { width: 1200, height: 800 },
  tile: { width: 900, height: 900 },
  wood: { width: 1200, height: 1800 },
  wood_paneling: { width: 1200, height: 1800 },
  stone: { width: 1800, height: 1400 },
  concrete: { width: 3000, height: 3000 },
  metal: { width: 2000, height: 2000 },
}

const SPREAD = { width: 1500, height: 1500 }

export const isColour = (worn: string | undefined): boolean =>
  worn !== undefined && COLOUR.test(worn)

export function paintFor(
  worn: string | undefined,
  bare: string,
  over?: { width: number; height: number },
): Finish {
  if (worn === undefined) return { colour: bare }
  if (isColour(worn)) return { colour: worn }

  const finish = finishOf(worn)
  if (!finish) return { colour: bare }
  if (finish.colour) return { colour: finish.colour }
  if (!finish.picture) return { colour: bare }

  const covers = COVERS[finish.category] ?? SPREAD
  const across = over ?? { width: 1000, height: 1000 }
  return {
    colour: '#ffffff',
    texture: `/${finish.picture}`,
    repeat: {
      x: tidy(across.width / covers.width),
      y: tidy(across.height / covers.height),
    },
  }
}

const tidy = (times: number) => Math.max(0.25, Math.round(times * 4) / 4)

export type Worn = {
  walls?: string
  ceiling?: string
  doors?: string
  windows?: string
}

export type Dressed = { outline: Point[]; worn: Worn | undefined }

export function besideWall(
  rooms: Dressed[],
  a: Point,
  b: Point,
  thickness: number,
): [Worn | undefined, Worn | undefined] {
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  if (span === 0) return [undefined, undefined]

  const across = { x: -(b.y - a.y) / span, y: (b.x - a.x) / span }
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const reach = thickness / 2 + PROBE

  const wornAt = (side: 1 | -1) => {
    const at = { x: middle.x + across.x * reach * side, y: middle.y + across.y * reach * side }
    return rooms.find((room) => containsPoint(room.outline, at.x, at.y))?.worn
  }

  return [wornAt(1), wornAt(-1)]
}
