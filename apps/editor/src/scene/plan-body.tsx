import { type ComponentProps, useEffect, useMemo } from 'react'
import { type Matrix4, MeshBasicMaterial, type Texture } from 'three'
import type { DisplaySurface } from '../engine/display-surface'
import { NativeSurface } from '../engine/fragment-display-layer'
import type { GeometryInput } from '../engine/geometry-protocol'
import { useNativeGeometry } from '../engine/use-wall-geometry'

export function PlanBody({
  id,
  entity,
  category,
  input,
  colour,
  transform,
  opacity = 1,
  texture,
  owner,
  ...events
}: {
  id: string
  entity?: string
  category: string
  input: GeometryInput
  colour: string
  transform: Matrix4
  opacity?: number
  texture?: Texture
  owner?: DisplaySurface['owner']
} & Omit<ComponentProps<typeof NativeSurface>, 'surface'>) {
  const { geometry, key } = useNativeGeometry(input)
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: colour,
        map: texture ?? null,
        opacity,
        transparent: !!texture || opacity < 1,
        depthWrite: opacity === 1,
      }),
    [colour, texture, opacity],
  )
  useEffect(() => () => material.dispose(), [material])
  if (!geometry) return null
  return (
    <NativeSurface
      surface={{
        id,
        entity,
        category,
        owner,
        geometry,
        geometryKey: key,
        materials: [material],
        transform,
        mapping: { kind: 'source', geometry },
        casts: false,
      }}
      {...events}
    />
  )
}
