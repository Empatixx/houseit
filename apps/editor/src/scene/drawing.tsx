import { Html, Line } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Matrix4, MeshBasicMaterial } from 'three'
import { NativeSurface } from '../engine/fragment-display-layer'
import { useNativeGeometry } from '../engine/use-wall-geometry'
import { useDraw } from '../store/draw'
import { EMPHASIS } from '../store/hover'
import { ABOVE, metres } from './dimensions'
import { MM, toWorld } from './plan-coordinates'

const THICKNESS = 150
const HEIGHT = 2800

export function Drawing() {
  const points = useDraw((state) => state.points)
  const cursor = useDraw((state) => state.cursor)
  const guides = useDraw((state) => state.guides)
  const corners = cursor && (points.length > 0 || guides.length > 0) ? [...points, cursor] : points
  if (corners.length === 0) return null

  const seen = new Map<string, number>()
  const keyed = corners.map((corner) => {
    const at = `${corner.x},${corner.y}`
    const times = seen.get(at) ?? 0
    seen.set(at, times + 1)
    return { corner, key: times === 0 ? at : `${at}#${times}` }
  })

  return (
    <>
      {guides.map((guide) => (
        <Line
          key={`${guide.from.x},${guide.from.y}`}
          points={[
            toWorld(guide.from.x, guide.from.y, ABOVE),
            toWorld(guide.to.x, guide.to.y, ABOVE),
          ]}
          color={EMPHASIS.picked.line}
          lineWidth={3}
          dashed
          dashSize={0.07}
          gapSize={0.09}
        />
      ))}
      {keyed.map(({ corner, key }) => (
        <mesh
          key={key}
          position={toWorld(corner.x, corner.y, HEIGHT + 40)}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.11, 20]} />
          <meshBasicMaterial color={EMPHASIS.picked.line} />
        </mesh>
      ))}
      {keyed.slice(1).map(({ corner: to }, offset) => {
        const { corner: from, key } = keyed[offset]!
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        if (length < 1) return null
        const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
        return (
          <group key={key}>
            <DrawingWall
              id={`drawing:${key}`}
              length={length}
              x={middle.x}
              y={middle.y}
              angle={Math.atan2(to.y - from.y, to.x - from.x)}
            />
            <Html
              position={toWorld(middle.x, middle.y, ABOVE)}
              center
              zIndexRange={[8, 5]}
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="pointer-events-none select-none whitespace-nowrap rounded bg-white/90 px-1 text-[11px] font-medium leading-4"
                style={{ color: EMPHASIS.picked.line }}
              >
                {metres(length)}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

function DrawingWall({
  id,
  length,
  x,
  y,
  angle,
}: {
  id: string
  length: number
  x: number
  y: number
  angle: number
}) {
  const { geometry, key } = useNativeGeometry({
    kind: 'primitive',
    body: { kind: 'box', width: length, height: HEIGHT, depth: THICKNESS },
  })
  const material = useMemo(
    () => new MeshBasicMaterial({ color: EMPHASIS.picked.line, transparent: true, opacity: 0.85 }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  if (!geometry) return null
  return (
    <NativeSurface
      gesture
      surface={{
        id,
        category: 'HOUSEITWALLPREVIEW',
        geometry,
        geometryKey: key,
        materials: [material],
        transform: new Matrix4()
          .makeRotationY(angle)
          .setPosition(x * MM, (HEIGHT / 2 + 20) * MM, -y * MM),
        mapping: { kind: 'source', geometry },
        casts: false,
      }}
    />
  )
}
