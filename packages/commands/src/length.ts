import { CommandError } from './command-error'

const UNITS: Record<string, number> = { mm: 1, cm: 10, m: 1000 }

const PATTERN = /^(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i

/**
 * Lengths as they are actually spoken and written. A bare number is millimetres,
 * which is what building drawings use; `m` and `cm` are accepted because that is
 * how people say a room is three and a half metres wide. A decimal comma works,
 * since that is how it is written here.
 *
 * The result is always whole millimetres — the document holds no floats.
 */
export function parseLength(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new CommandError(`not a length: ${input}`)
    return Math.round(input)
  }

  const match = PATTERN.exec(input.trim())
  if (!match) {
    throw new CommandError(`not a length: "${input}" (try 3600, 3.6m or 360cm)`)
  }

  const value = Number(match[1]!.replace(',', '.'))
  const unit = UNITS[(match[2] ?? 'mm').toLowerCase()]!
  return Math.round(value * unit)
}
