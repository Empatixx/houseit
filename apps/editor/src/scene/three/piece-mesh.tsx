import type { Owner } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import { type BufferGeometry, Euler, type Material, Matrix4 } from 'three'
import { NativeSurface } from '../../engine/fragment-display-layer'
import { MM } from '../plan-coordinates'

export type NativePiece = { id: string; elevation: number; owner?: Owner; category?: string }

type Props = {
  native: NativePiece
  geometry: BufferGeometry
  geometryKey?: string
  material: Material | Material[]
  at: [number, number, number]
  rotation: [number, number, number, 'YXZ']
  receives?: boolean
  shadows: boolean
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

export function PieceMesh({
  native,
  geometry,
  geometryKey,
  material,
  at,
  rotation,
  shadows,
  receives = true,
  onPick,
}: Props) {
  const transform = new Matrix4().makeRotationFromEuler(new Euler(...rotation))
  transform.setPosition(at[0], at[1] + native.elevation * MM, at[2])
  return (
    <NativeSurface
      surface={{
        id: native.id,
        owner: native.owner,
        category: native.category ?? 'IFCFURNISHINGELEMENT',
        geometry,
        geometryKey,
        materials: Array.isArray(material) ? material : [material],
        transform,
        mapping: geometryKey ? { kind: 'source', geometry } : { kind: 'flat' },
        casts: shadows,
        receives,
      }}
      onClick={onPick}
    />
  )
}
