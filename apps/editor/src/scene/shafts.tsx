import { shaftsOn, shaftWallParts } from '@houseit/geometry/connections'
import { useDocument, usePlanDoc } from '../store/store'
import { MM } from './plan-coordinates'

export function Shafts() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  return (
    <>
      {shaftsOn(doc, level).flatMap((s) =>
        shaftWallParts(s).map((p) => (
          <mesh key={`${s.id}-${p.x}-${p.y}`} position={[p.x * MM, 3, -p.y * MM]}>
            <boxGeometry args={[p.width * MM, 0.03, p.depth * MM]} />
            <meshBasicMaterial color={p.door ? '#a3a7aa' : '#343638'} />
          </mesh>
        )),
      )}
    </>
  )
}
