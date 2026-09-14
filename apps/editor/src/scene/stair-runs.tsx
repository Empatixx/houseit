import type { StairRun } from '@houseit/core/stair-flight'
import { treadsOf } from '@houseit/core/stairs'
import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Matrix4 } from 'three'
import { useDocument, usePlanDoc } from '../store/store'
import { PlanBody } from './plan-body'
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
        return {
          step: t.step,
          outline: t.outline.map((p) => ({ x: p.x, z: -p.y })),
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
          <PlanBody
            id={`stair:${stair.id}:${p.step}`}
            category="IFCSTAIRFLIGHT"
            input={{ kind: 'profile', body: { kind: 'sheet', outline: p.outline, holes: [] } }}
            colour={below ? '#d4d4d4' : '#f7f6f1'}
            transform={new Matrix4()
              .makeRotationX(-Math.PI / 2)
              .setPosition(0, below ? -0.02 : 0.04, 0)}
          />
          <Line points={p.points} color="#363636" lineWidth={1} />
        </group>
      ))}
    </>
  )
}
