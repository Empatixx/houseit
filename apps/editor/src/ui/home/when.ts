const UNITS = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
] as const

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function when(at: number): string {
  const since = at - Date.now()
  for (const [unit, ms] of UNITS) {
    if (Math.abs(since) >= ms) return relative.format(Math.round(since / ms), unit)
  }
  return 'just now'
}
