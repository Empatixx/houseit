import { useEffect, useMemo } from 'react'
import { type Matrix4, MeshBasicMaterial } from 'three'
import { NativeSurface } from '../engine/fragment-display-layer'
import type { GeometryInput } from '../engine/geometry-protocol'
import { useNativeGeometry } from '../engine/use-wall-geometry'

export function PlanBody({
  id,
  category,
  input,
  colour,
  transform,
}: {
  id: string
  category: string
  input: GeometryInput
  colour: string
  transform: Matrix4
}) {
  const { geometry, key } = useNativeGeometry(input)
  const material = useMemo(() => new MeshBasicMaterial({ color: colour }), [colour])
  useEffect(() => () => material.dispose(), [material])
  if (!geometry) return null
  return (
    <NativeSurface
      surface={{
        id,
        category,
        geometry,
        geometryKey: key,
        materials: [material],
        transform,
        mapping: { kind: 'source', geometry },
        casts: false,
      }}
    />
  )
}
