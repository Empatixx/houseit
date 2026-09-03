import type { HouseDocument, Side } from '@houseit/core/document'
import type { Room } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import type { Draft } from 'immer'
import { z } from 'zod'
import { CommandError } from './command-error'
import { parseLength } from './length'

/** Where along a side: as a fraction of it, or as a length from one end of it. */
export type Along = { fraction: number } | { length: number }

/**
 * An `--along` option. `0.5` is halfway; `2.4m` or `2400` is that far from
 * the west or south end, and `-2.4m` that far from the other end. A bare
 * number no bigger than one is a fraction, which is what the editor and
 * `describe` say; anything bigger, or anything with a unit, is millimetres.
 */
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

/** The fraction of a run an `--along` lands on, refused if it is off the end of it. */
export function fractionOf(spec: Along, run: { length: number }, what: string): number {
  if ('fraction' in spec) return spec.fraction
  const from = spec.length < 0 ? run.length + spec.length : spec.length
  if (from < 0 || from > run.length) {
    throw new CommandError(
      `${what}: ${Math.abs(spec.length)} mm is beyond the ${run.length} mm of that side`,
    )
  }
  return run.length === 0 ? 0 : from / run.length
}

/** The fraction of a room's side an `--along` lands on, or a refusal naming the side. */
export function alongSide(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  room: Room,
  side: Side,
  nth: number | undefined,
  spec: Along,
  what: string,
): number {
  const run = sideRun(doc, level, room, side, nth)
  if (!run) throw new CommandError(`${what}: ${room.name} has no wall facing ${side}`)
  return fractionOf(spec, run, what)
}
