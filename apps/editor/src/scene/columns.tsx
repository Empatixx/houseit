import { useDocument, usePlanDoc } from '../store/store'
import { MM } from './plan-coordinates'

export function Columns() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  return (
    <>
      {(doc.levels[level]?.columns ?? []).map((c) => (
        <mesh key={c.id} position={[c.x * MM, 3, -c.y * MM]}>
          <boxGeometry args={[c.width * MM, 0.03, c.depth * MM]} />
          <meshBasicMaterial color="#343638" />
        </mesh>
      ))}
    </>
  )
}
