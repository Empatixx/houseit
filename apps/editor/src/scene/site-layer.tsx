import type { PointMm } from '@houseit/core/parcel-site'
import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import { BufferGeometry, Path, Shape, ShapeGeometry, ShapePath, Vector3 } from 'three'
import { useShown } from '../store/shown'
import { usePlanDoc } from '../store/store'
import { MM, toWorld } from './plan-coordinates'
import { drawingOfSite } from './site-drawing'

export function SiteLayer() {
  const doc = usePlanDoc()
  const visible = useShown((state) => state.shown.site)
  const drawing = useMemo(
    () => (doc.parcelSite ? drawingOfSite(doc.parcelSite) : null),
    [doc.parcelSite],
  )
  const geometry = useMemo(() => {
    if (!drawing) return null
    const parcels = drawing.parcels.map((polygon) => new ShapeGeometry(shapeOf(polygon)))
    const buildable = shapesOf(drawing.buildable).map((shape) => new ShapeGeometry(shape))
    const edges = drawing.edges.map((edge) => ({
      ...edge,
      geometry: new BufferGeometry().setFromPoints([vectorOf(edge.from), vectorOf(edge.to)]),
    }))
    return { parcels, buildable, edges }
  }, [drawing])

  if (!visible || !geometry) return null

  return (
    <group>
      {geometry.parcels.map((parcel) => (
        <mesh
          key={parcel.uuid}
          geometry={parcel}
          position={[0, -0.04, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial color="#d9d5ca" transparent opacity={0.42} depthWrite={false} />
        </mesh>
      ))}
      {geometry.buildable.map((area) => (
        <mesh
          key={area.uuid}
          geometry={area}
          position={[0, -0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial color="#b9ddc2" transparent opacity={0.42} depthWrite={false} />
        </mesh>
      ))}
      {geometry.edges.map((edge) => {
        const middle = {
          x: (edge.from.x + edge.to.x) / 2,
          y: (edge.from.y + edge.to.y) / 2,
        }
        return (
          <group key={edge.id}>
            <lineSegments
              geometry={edge.geometry}
              position={[0, -0.02, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <lineBasicMaterial color={edge.setbackMm > 0 ? '#9b5d48' : '#506f59'} />
            </lineSegments>
            <Html
              position={toWorld(middle.x, middle.y, 10)}
              center
              zIndexRange={[4, 1]}
              style={{ pointerEvents: 'none' }}
            >
              <span className="pointer-events-none inline-flex size-5 select-none items-center justify-center rounded-full border border-amber-800/40 bg-white/90 text-[10px] font-semibold text-amber-900 shadow-sm">
                {edge.number}
              </span>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

function vectorOf(point: PointMm): Vector3 {
  return new Vector3(point.x * MM, point.y * MM, 0)
}

function shapeOf(polygon: { outer: PointMm[]; holes: PointMm[][] }): Shape {
  const shape = pathInto(new Shape(), polygon.outer)
  for (const ring of polygon.holes) shape.holes.push(pathInto(new Path(), ring))
  return shape
}

function shapesOf(rings: PointMm[][]): Shape[] {
  const paths = new ShapePath()
  for (const ring of rings) {
    ring.forEach((point, index) => {
      if (index === 0) paths.moveTo(point.x * MM, point.y * MM)
      else paths.lineTo(point.x * MM, point.y * MM)
    })
    paths.currentPath?.closePath()
  }
  return paths.toShapes()
}

function pathInto<T extends Path>(path: T, points: PointMm[]): T {
  points.forEach((point, index) => {
    if (index === 0) path.moveTo(point.x * MM, point.y * MM)
    else path.lineTo(point.x * MM, point.y * MM)
  })
  path.closePath()
  return path
}
