import type { BufferGeometry, Material, Matrix4 } from 'three'
import type { Selection } from '../store/selection'

export type DisplaySurface = {
  id: string
  entity?: string
  geometry: BufferGeometry
  geometryKey?: string
  materials: Material[]
  transform: Matrix4
  mapping:
    | { kind: 'wall'; length: number; height: number }
    | { kind: 'flat' }
    | { kind: 'source'; geometry: BufferGeometry }
  owner?: Selection
  category: string
  casts: boolean
  receives?: boolean
}

export type TileSurface = {
  surface: Pick<DisplaySurface, 'id' | 'transform' | 'mapping' | 'materials'>
}
