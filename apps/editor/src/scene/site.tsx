import { nestedEntityKey } from '@houseit/core/entity-key'
import { floorMaterial } from '@houseit/core/floor-materials'
import { Html, Line } from '@react-three/drei'
import { Matrix4 } from 'three'
import { useDocument, usePlanDoc } from '../store/store'
import { PlanBody } from './plan-body'
import { MM } from './plan-coordinates'

export function Site() {
  const doc = usePlanDoc()
  const level = useDocument((s) => s.level)
  const site = doc.site
  if (!site || doc.levels[level]?.elevation !== 0) return null
  return (
    <>
      {site.surfaces.map((s) => (
        <PlanBody
          key={s.id}
          id={`site:surface:${s.id}`}
          entity={nestedEntityKey('surfaces', 'terrain', s.id)}
          category="IFCGEOGRAPHICELEMENT"
          input={{
            kind: 'profile',
            body: {
              kind: 'sheet',
              outline: s.outline.map((p) => ({ x: p.x, z: -p.y })),
              holes: [],
            },
          }}
          colour={(s.material && floorMaterial(s.material)?.colour) || s.colour}
          transform={new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, -0.05, 0)}
        />
      ))}
      {site.markings.map((m) => (
        <Line
          key={m.id}
          points={m.points.map((p) => [p.x * MM, -0.04, -p.y * MM])}
          color={m.colour}
          lineWidth={2}
        />
      ))}
      {site.railings.map((r) => (
        <Line
          key={r.id}
          points={r.points.map((p) => [p.x * MM, 0.02, -p.y * MM])}
          color={r.colour}
          lineWidth={2}
        />
      ))}
      {site.surfaces
        .filter((s) => s.name.startsWith('Stání '))
        .map((s) => (
          <Html
            key={s.id}
            position={[
              (s.outline.reduce((v, p) => v + p.x, 0) / s.outline.length) * MM,
              0.02,
              (-s.outline.reduce((v, p) => v + p.y, 0) / s.outline.length) * MM,
            ]}
            center
            style={{ pointerEvents: 'none', fontSize: 9, whiteSpace: 'nowrap' }}
          >
            {s.name}
          </Html>
        ))}
    </>
  )
}
