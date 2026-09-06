import { Html } from '@react-three/drei'
import { useDraw } from '../store/draw'
import { EMPHASIS } from '../store/hover'
import { ABOVE, metres } from './dimensions'
import { MM, toWorld } from './plan-coordinates'

const THICKNESS = 150
const HEIGHT = 2800

export function Drawing() {
  const points = useDraw((state) => state.points)
  const cursor = useDraw((state) => state.cursor)
  const corners = cursor && points.length > 0 ? [...points, cursor] : points
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
      {keyed.slice(1).map(({ corner: to, key }, offset) => {
        const from = keyed[offset]!.corner
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        if (length < 1) return null
        const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
        return (
          <group key={`${keyed[offset]!.key}>${key}`}>
            <mesh
              position={toWorld(middle.x, middle.y, HEIGHT / 2 + 20)}
              rotation={[0, Math.atan2(to.y - from.y, to.x - from.x), 0]}
            >
              <boxGeometry args={[length * MM, HEIGHT * MM, THICKNESS * MM]} />
              <meshBasicMaterial color={EMPHASIS.picked.line} transparent opacity={0.85} />
            </mesh>
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
