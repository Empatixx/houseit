import type { HouseDocument, Side } from '@houseit/core/document'
import type { Room } from '@houseit/geometry/rooms'
import { sideRun, stretchOf } from '@houseit/geometry/sides'
import type { Draft } from 'immer'
import { z } from 'zod'
import { CommandError } from './command-error'
import { parseLength } from './length'

export type Along = { fraction: number } | { length: number }

export const along = () =>
  z.union([z.number(), z.string()]).transform((value, ctx): Along => {
    const text = typeof value === 'number' ? String(value) : value.trim()
    if (/^-?\d*\.?\d+$/.test(text)) {
      const number = Number(text)
      if (number >= 0 && number <= 1) return { fraction: number }
      if (Number.isInteger(number)) return { length: number }
      ctx.addIssue({
        code: 'custom',
        message: `${text} is neither a fraction of the side nor a length along it`,
      })
      return z.NEVER
    }
    try {
      return { length: parseLength(text.replace(/^-/, '')) * (text.startsWith('-') ? -1 : 1) }
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: (error as Error).message })
      return z.NEVER
    }
  })

export function fractionOf(spec: Along, run: { length: number }, what: string): number {
  if ('fraction' in spec) return spec.fraction
  const from = spec.length < 0 ? run.length + spec.length : spec.length
  if (from < 0 || from > run.length) {
    throw new CommandError(
      `${what}: ${Math.abs(spec.length)} mm is beyond the ${run.length} mm there`,
    )
  }
  return run.length === 0 ? 0 : from / run.length
}

export type At = { side: Side; nth?: number; wall?: string }

export function alongSide(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  room: Room,
  at: At,
  spec: Along,
  what: string,
): number {
  const run = sideRun(doc, level, room, at.side, at.nth)
  if (!run) throw new CommandError(`${what}: ${room.name} has no wall facing ${at.side}`)
  const window = windowOf(run, at, room, what)
  if (!window) return fractionOf(spec, run, what)
  const within = fractionOf(spec, { length: window.to - window.from }, what)
  return run.length === 0 ? 0 : (window.from + within * (window.to - window.from)) / run.length
}

export function windowOf(
  run: { length: number; walls: { wall: string }[] } & Parameters<typeof stretchOf>[0],
  at: At,
  room: Room,
  what: string,
): { from: number; to: number } | undefined {
  if (at.wall === undefined) return undefined
  const stretch = stretchOf(run, at.wall)
  if (!stretch)
    throw new CommandError(`${what}: ${at.wall} is not on the ${at.side} side of ${room.name}`)
  return stretch
}

export function fractionAcross(
  doc: HouseDocument | Draft<HouseDocument>,
  room: Room,
  spec: Along,
  what: string,
): number {
  const ys = room.nodes.map((node) => doc.nodes[node]?.y ?? 0)
  const depth = Math.max(...ys) - Math.min(...ys)
  return fractionOf(spec, { length: depth }, what)
}
