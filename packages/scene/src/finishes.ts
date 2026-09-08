import type { Surface } from '@houseit/core/surfaces'
import type { Finish } from './pieces'

const GRAINED: Record<string, { photo: string; tint: string }> = {
  oak: { photo: 'surfaces/natural-oak.jpg', tint: '#f3e4c9' },
  walnut: { photo: 'surfaces/red-oak.jpg', tint: '#8c6446' },
  marble: { photo: 'surfaces/marble-white.jpg', tint: '#ffffff' },
}

export function paintOf(surface: Surface): { body: Finish; frame: Finish } {
  const grained = GRAINED[surface.id]
  return {
    body: grained ? { colour: grained.tint, texture: grained.photo } : { colour: surface.fill },
    frame: { colour: surface.line },
  }
}

export const PAINT = {
  porcelain: { colour: '#f7f7f5' },
  pale: { colour: '#e8edf0' },
  worktop: { colour: '#e4e1db', roughness: 0.5 },
  steel: { colour: '#c9ced3', roughness: 0.35 },
  dark: { colour: '#3a3a3c' },
  black: { colour: '#1f1f21' },
  glass: { colour: '#bcd7ee', opacity: 0.4, roughness: 0.08 },
  mirror: { colour: '#cfe0ea', roughness: 0.05 },
  tinted: { colour: '#4a5661', opacity: 0.85 },
  shade: { colour: '#ece6d8' },
  terracotta: { colour: '#b5806a' },
  soil: { colour: '#5a4634' },
  leaf: { colour: '#5f8f52' },
  leafDark: { colour: '#4e7a43' },
  leafLight: { colour: '#729f63' },
  felt: { colour: '#3f7a4f' },
  canvas: { colour: '#d8cbb6' },
  wall: { colour: '#f1f0ed' },
  lamp: { colour: '#fff4d6' },
  red: { colour: '#c8423a' },
} as const satisfies Record<string, Finish>

export function lighter(paint: Finish, amount = 0.1): Finish {
  const hex = paint.colour.replace('#', '')
  const channel = (at: number) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16)
    return Math.round(value + (255 - value) * amount)
      .toString(16)
      .padStart(2, '0')
  }
  return { ...paint, colour: `#${channel(0)}${channel(2)}${channel(4)}` }
}
