/**
 * Short, readable ids — `n1`, `w7` — rather than UUIDs, because they show up in
 * every command the agent writes and in every error message you read back.
 */
export function allocateId(existing: Record<string, unknown>, prefix: string): string {
  let highest = 0
  for (const key of Object.keys(existing)) {
    if (!key.startsWith(prefix)) continue
    const suffix = Number(key.slice(prefix.length))
    if (Number.isInteger(suffix) && suffix > highest) highest = suffix
  }
  return `${prefix}${highest + 1}`
}
