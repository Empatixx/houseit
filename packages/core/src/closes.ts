type Edge = { a: string; b: string }

export function closes(walls: Record<string, Edge | undefined>, loop: readonly string[]): boolean {
  if (loop.length < 3) return false

  const edges = loop.map((id) => walls[id])
  if (edges.some((edge) => edge === undefined)) return false

  // A room boundary walks out and back along an open return. Consecutive
  // occurrences of the same wall are valid when the oriented walk closes.
  return [edges[0]!.a, edges[0]!.b].some((start) => {
    let at = start
    for (const edge of edges) {
      if (edge!.a === at) at = edge!.b
      else if (edge!.b === at) at = edge!.a
      else return false
    }
    return at === start
  })
}
