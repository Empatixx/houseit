import type { HouseDocument } from '@houseit/core/document'
import { nestedEntityKey } from '@houseit/core/entity-key'
import { fenceStretches } from '@houseit/core/fences'
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
  if (doc.levels[level]?.elevation !== 0) return null
  return (
    <>
      <Fences doc={doc} />
      {site ? <Terrain site={site} /> : null}
    </>
  )
}

function Fences({ doc }: { doc: HouseDocument }) {
  const fences = Object.values(doc.fences ?? {})
  return (
    <>
      {fences.map((fence) =>
        fenceStretches(fence).map((stretch) => (
          <Line
            key={`${fence.id}:${Math.round(stretch.from.x)},${Math.round(stretch.from.y)}`}
            points={[
              [stretch.from.x * MM, 0.03, -stretch.from.y * MM],
              [stretch.to.x * MM, 0.03, -stretch.to.y * MM],
            ]}
            color={stretch.gate ? '#8a8f96' : '#3b3f45'}
            lineWidth={stretch.gate ? 1.5 : 3}
            dashed={stretch.gate}
            dashSize={0.15}
            gapSize={0.1}
          />
        )),
      )}
    </>
  )
}

function Terrain({ site }: { site: NonNullable<HouseDocument['site']> }) {
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
        .filter((s) => s.name.startsWith('Parking '))
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
