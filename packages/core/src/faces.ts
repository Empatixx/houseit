import type { HouseDocument } from './document'

export type Face = {
  nodes: string[]
  walls: string[]
  area: number
}

type HalfEdge = { from: string; to: string; key: string; wall: string }

const halfEdgeKey = (from: string, to: string) => `${from}>${to}`

export function findFaces(doc: HouseDocument, level: string): Face[] {
  const outgoing = new Map<string, HalfEdge[]>()

  const add = (from: string, to: string, wall: string) => {
    const edges = outgoing.get(from) ?? []
    edges.push({ from, to, key: halfEdgeKey(from, to), wall })
    outgoing.set(from, edges)
  }

  for (const wall of Object.values(doc.walls)) {
    if (wall.level !== level || wall.a === wall.b) continue
    if (!doc.nodes[wall.a] || !doc.nodes[wall.b]) continue
    add(wall.a, wall.b, wall.id)
    add(wall.b, wall.a, wall.id)
  }

  const angleAt = (from: string, to: string) => {
    const a = doc.nodes[from]!
    const b = doc.nodes[to]!
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  const rank = new Map<string, number>()
  for (const [node, edges] of outgoing) {
    edges.sort((left, right) => {
      const byAngle = angleAt(node, left.to) - angleAt(node, right.to)
      return byAngle !== 0 ? byAngle : left.to.localeCompare(right.to)
    })
    edges.forEach((edge, index) => {
      rank.set(edge.key, index)
    })
  }

  const step = (edge: HalfEdge): HalfEdge => {
    const fan = outgoing.get(edge.to)!
    const twin = rank.get(halfEdgeKey(edge.to, edge.from))!
    return fan[(twin - 1 + fan.length) % fan.length]!
  }

  const all = [...outgoing.values()].flat()
  const visited = new Set<string>()
  const faces: Face[] = []

  for (const start of all) {
    if (visited.has(start.key)) continue

    const cycle: HalfEdge[] = []
    let edge = start
    for (let guard = 0; guard <= all.length; guard += 1) {
      visited.add(edge.key)
      cycle.push(edge)
      edge = step(edge)
      if (edge.key === start.key) break
    }

    const nodes = cycle.map((half) => half.from)
    const walls = cycle.map((half) => half.wall)
    const area = signedArea(doc, nodes)
    if (area > 0) faces.push({ nodes, walls, area })
  }

  return faces
}

function signedArea(doc: HouseDocument, nodes: string[]): number {
  let total = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const current = doc.nodes[nodes[i]!]!
    const next = doc.nodes[nodes[(i + 1) % nodes.length]!]!
    total += current.x * next.y - next.x * current.y
  }
  return total / 2
}
