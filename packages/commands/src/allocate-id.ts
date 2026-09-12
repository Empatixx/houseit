export function allocateId(existing: Record<string, unknown>, prefix: string): string {
  let highest = 0
  const reserved = Object.values(existing).flatMap((entry) =>
    entry && typeof entry === 'object' && 'element' in entry && typeof entry.element === 'string'
      ? [entry.element]
      : [],
  )
  for (const key of [...Object.keys(existing), ...reserved]) {
    if (!key.startsWith(prefix)) continue
    const suffix = Number(key.slice(prefix.length))
    if (Number.isInteger(suffix) && suffix > highest) highest = suffix
  }
  return `${prefix}${highest + 1}`
}
