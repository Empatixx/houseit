import { rampDirection, rampHeights } from '@houseit/geometry/connections'
import { Html, Line } from '@react-three/drei'
import { Matrix4 } from 'three'
import { useDocument, usePlanDoc } from '../store/store'
import { PlanBody } from './plan-body'
import { MM } from './plan-coordinates'

export function Ramps() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  return (
    <>
      {(doc.levels[level]?.ramps ?? []).map((r) => {
        const d = rampDirection(r)
        const heights = rampHeights(doc, level, r)
        if (!heights) return null
        const point = (t: number, side = 0): [number, number, number] => [
          (r.x + d.x * r.length * t - d.y * side) * MM,
          0.06,
          -(r.y + d.y * r.length * t + d.x * side) * MM,
        ]
        const middle = point(0.5)
        return (
          <group key={r.id}>
            <PlanBody
              id={`ramp:${level}:${r.id}`}
              category="IFCRAMP"
              input={{
                kind: 'primitive',
                body: {
                  kind: 'box',
                  width: d.x ? r.length : r.width,
                  height: 20,
                  depth: d.x ? r.width : r.length,
                },
              }}
              colour={r.colour}
              transform={new Matrix4().makeTranslation(middle[0], 0.02, middle[2])}
            />
            <Line
              points={[
                point(0, -r.width / 2),
                point(1, -r.width / 2),
                point(1, r.width / 2),
                point(0, r.width / 2),
                point(0, -r.width / 2),
              ]}
              color="#62666b"
              lineWidth={1}
            />
            <Line
              points={[
                point(0.2),
                point(0.8),
                point(0.8 - 500 / r.length, 400),
                point(0.8),
                point(0.8 - 500 / r.length, -400),
              ]}
              color="#44484d"
              lineWidth={1}
            />
            <Html
              position={point(0.5, r.width / 3)}
              center
              style={{ pointerEvents: 'none', whiteSpace: 'nowrap', fontSize: 10 }}
            >
              {((heights.rise / r.length) * 100).toFixed(1)} %
            </Html>
          </group>
        )
      })}
    </>
  )
}
