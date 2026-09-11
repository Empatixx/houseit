type Edge = { a: string; b: string }

export function closes(walls: Record<string, Edge | undefined>, loop: readonly string[]): boolean {
  if (loop.length < 3) return false

  const edges = loop.map((id) => walls[id])
  if (edges.some((edge) => edge === undefined)) return false

  for (let i = 0; i < edges.length; i += 1) {
    const here = edges[i]!
    const next = edges[(i + 1) % edges.length]!
    const shared = [here.a, here.b].filter((node) => node === next.a || node === next.b)
    if (shared.length !== 1) return false
  }

  return true
}
