import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Dimension } from '@houseit/geometry/dimensions'
import { Edges } from '@react-three/drei'
import { useMemo } from 'react'
import { useWallGeometry } from '../engine/use-wall-geometry'
import { wallBody } from '../engine/wall-body'
import { usePreview } from '../store/preview'
import { useSelection } from '../store/selection'
import { useDocument } from '../store/store'
import { DimensionLine } from './dimensions'
import { usePlain } from './plain'
import { toWorld } from './plan-coordinates'

export function WallPreview() {
  const original = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const preview = usePreview((state) => state.doc)
  const selected = useSelection((state) => state.selected)
  const plain = usePlain()
  if (!preview || plain) return null
  const moved = Object.values(original.walls).filter((wall) => {
    if (wall.level !== level) return false
    const next = preview.walls[wall.id]
    return (
      !next ||
      [wall.a, wall.b].some((id) => {
        const before = original.nodes[id],
          after = preview.nodes[id]
        return before && (!after || before.x !== after.x || before.y !== after.y)
      })
    )
  })
  const translated = (wall: Wall) => {
    const a = original.nodes[wall.a]!,
      b = original.nodes[wall.b]!
    const nextA = preview.nodes[wall.a],
      nextB = preview.nodes[wall.b]
    return nextA && nextB && nextA.x - a.x === nextB.x - b.x && nextA.y - a.y === nextB.y - b.y
  }
  const primary =
    moved.find((wall) => selected?.kind === 'wall' && wall.id === selected.id) ??
    moved.find(translated) ??
    moved[0]
  let displacement: Dimension | undefined
  if (primary) {
    const a = original.nodes[primary.a]!,
      b = original.nodes[primary.b]!
    const nextA = preview.nodes[primary.a],
      nextB = preview.nodes[primary.b]
    if (nextA && nextB) {
      const moving = translated(primary)
      const from = moving
        ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        : nextA.x !== a.x || nextA.y !== a.y
          ? a
          : b
      const to = moving
        ? { x: (nextA.x + nextB.x) / 2, y: (nextA.y + nextB.y) / 2 }
        : from === a
          ? nextA
          : nextB
      displacement = {
        from,
        to,
        length: Math.hypot(to.x - from.x, to.y - from.y),
        offset: { x: 1, y: 0 },
      }
    }
  }
  return (
    <>
      {moved.map((wall) => (
        <OriginalWall key={wall.id} doc={original} wall={wall} />
      ))}
      {displacement ? <DimensionLine dimension={displacement} /> : null}
    </>
  )
}

function OriginalWall({ doc, wall }: { doc: HouseDocument; wall: Wall }) {
  const body = useMemo(() => wallBody(doc, wall, true), [doc, wall])
  const geometry = useWallGeometry(body)
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  if (!geometry) return null
  return (
    <group
      position={toWorld(a.x, a.y, wall.baseOffset)}
      rotation={[0, Math.atan2(b.y - a.y, b.x - a.x), 0]}
    >
      <Edges
        geometry={geometry}
        color="#71717a"
        lineWidth={1.5}
        dashed
        dashSize={0.08}
        gapSize={0.06}
        depthTest={false}
        raycast={() => {}}
      />
    </group>
  )
}
