import type { Surface } from '@houseit/core/surfaces'
import { RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from 'three'

/** What a face is painted: a colour, and a photograph over it where the finish has one. */
export type Paint = { color: string; map?: Texture; transparent?: boolean; opacity?: number }

/**
 * The finishes with a grain: they borrow the floor photographs, which are the
 * wood and stone the plan already has, tinted towards the finish's own colour.
 * Everything else is its flat colour, which is what fabric and steel look like
 * from across a room anyway.
 */
const GRAINED: Record<string, { photo: string; tint: string }> = {
  oak: { photo: 'natural-oak', tint: '#f3e4c9' },
  walnut: { photo: 'red-oak', tint: '#8c6446' },
  marble: { photo: 'marble-white', tint: '#ffffff' },
}

const loader = new TextureLoader()
const photos = new Map<string, Texture>()

/** The photograph for a finish, loaded once; one repeat per face. */
function photoOf(name: string): Texture {
  const cached = photos.get(name)
  if (cached) return cached
  const texture = loader.load(`textures/surfaces/${name}.jpg`)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  photos.set(name, texture)
  return texture
}

/** The paint for a thing's body in a finish, and for its frame — the darker line of the same. */
export function paintOf(surface: Surface): { body: Paint; frame: Paint } {
  const grained = GRAINED[surface.id]
  return {
    body: grained ? { color: grained.tint, map: photoOf(grained.photo) } : { color: surface.fill },
    frame: { color: surface.line },
  }
}

/** The paints everything shares, whatever finish a thing is in. */
export const PAINT = {
  porcelain: { color: '#f7f7f5' },
  pale: { color: '#e8edf0' },
  worktop: { color: '#e4e1db' },
  steel: { color: '#c9ced3' },
  dark: { color: '#3a3a3c' },
  black: { color: '#1f1f21' },
  glass: { color: '#bcd7ee', transparent: true, opacity: 0.4 },
  mirror: { color: '#cfe0ea' },
  tinted: { color: '#4a5661', transparent: true, opacity: 0.85 },
  shade: { color: '#ece6d8' },
  terracotta: { color: '#b5806a' },
  soil: { color: '#5a4634' },
  leaf: { color: '#5f8f52' },
  leafDark: { color: '#4e7a43' },
  leafLight: { color: '#729f63' },
  felt: { color: '#3f7a4f' },
  canvas: { color: '#d8cbb6' },
  wall: { color: '#f1f0ed' },
  lamp: { color: '#fff4d6' },
  red: { color: '#c8423a' },
} as const satisfies Record<string, Paint>

/** A paint a little lighter, for a cushion on a seat of the same cloth. */
export function lighter(paint: Paint, amount = 0.1): Paint {
  const hex = paint.color.replace('#', '')
  const channel = (at: number) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16)
    return Math.round(value + (255 - value) * amount)
      .toString(16)
      .padStart(2, '0')
  }
  return { ...paint, color: `#${channel(0)}${channel(2)}${channel(4)}` }
}
