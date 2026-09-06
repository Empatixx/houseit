export function allocateId(existing: Record<string, unknown>, prefix: string): string {
  let highest = 0
  for (const key of Object.keys(existing)) {
    if (!key.startsWith(prefix)) continue
    const suffix = Number(key.slice(prefix.length))
    if (Number.isInteger(suffix) && suffix > highest) highest = suffix
  }
  return `${prefix}${highest + 1}`
}
