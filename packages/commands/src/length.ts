import { CommandError } from './command-error'

const UNITS: Record<string, number> = { mm: 1, cm: 10, m: 1000 }

const PATTERN = /^(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i

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

export function typedLength(typed: string): number | undefined {
  const text = typed.trim().replace(',', '.')
  if (!/\d/.test(text)) return undefined
  try {
    const bare = /^\d+(\.\d+)?$/.test(text)
    const length =
      bare && (text.includes('.') || Number(text) < 100)
        ? parseLength(`${text}m`)
        : parseLength(text)
    return length > 0 ? length : undefined
  } catch {
    return undefined
  }
}
