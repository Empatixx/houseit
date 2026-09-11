import type { StairRun } from '@houseit/core/stair-flight'
import { treadsOf } from '@houseit/core/stairs'
import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Shape, ShapeGeometry } from 'three'
import { useDocument, usePlanDoc } from '../store/store'
import { MM } from './plan-coordinates'

export function StairRuns() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  return (
    <>
      {Object.values(doc.levels).flatMap((base) =>
        (base.stairs ?? [])
          .filter((s) => base.id === level || s.to === level)
          .map((s) => <Run key={s.id} stair={s} below={base.id !== level} />),
      )}
    </>
  )
}
function Run({ stair, below }: { stair: StairRun; below: boolean }) {
  const parts = useMemo(
    () =>
      treadsOf(stair).map((t) => {
        const shape = new Shape()
        t.outline.forEach((p, i) => {
          if (i === 0) shape.moveTo(p.x * MM, p.y * MM)
          else shape.lineTo(p.x * MM, p.y * MM)
        })
        shape.closePath()
        return {
          step: t.step,
          geometry: new ShapeGeometry(shape),
          points: [...t.outline, t.outline[0]!].map(
            (p) => [p.x * MM, below ? -0.01 : 0.05, -p.y * MM] as [number, number, number],
          ),
        }
      }),
    [stair, below],
  )
  return (
    <>
      {parts.map((p) => (
        <group key={p.step}>
          <mesh
            geometry={p.geometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, below ? -0.02 : 0.04, 0]}
          >
            <meshBasicMaterial color={below ? '#d4d4d4' : '#f7f6f1'} />
          </mesh>
          <Line points={p.points} color="#363636" lineWidth={1} />
        </group>
      ))}
    </>
  )
}
