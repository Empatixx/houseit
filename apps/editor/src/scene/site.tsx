import { floorMaterial } from '@houseit/core/floor-materials'
import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Shape, ShapeGeometry } from 'three'
import { useDocument, usePlanDoc } from '../store/store'
import { MM } from './plan-coordinates'

export function Site() {
  const doc = usePlanDoc()
  const level = useDocument((s) => s.level)
  const site = doc.site
  const surfaces = useMemo(
    () =>
      site?.surfaces.map((s) => {
        const shape = new Shape()
        s.outline.forEach((p, i) => {
          if (i) shape.lineTo(p.x * MM, p.y * MM)
          else shape.moveTo(p.x * MM, p.y * MM)
        })
        shape.closePath()
        return { ...s, geometry: new ShapeGeometry(shape) }
      }) ?? [],
    [site],
  )
  if (!site || doc.levels[level]?.elevation !== 0) return null
  return (
    <>
      {surfaces.map((s) => (
        <mesh
          key={s.id}
          geometry={s.geometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.05, 0]}
        >
          <meshBasicMaterial
            color={(s.material && floorMaterial(s.material)?.colour) || s.colour}
          />
        </mesh>
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
      {surfaces
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
