import { excavations } from '@houseit/geometry/excavation'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { groundTexture, paintGround } from '../../engine/ground-appearance'
import { useNativeGeometry } from '../../engine/use-wall-geometry'
import { useDocument } from '../../store/store'
import { useWalk } from '../../store/walk'
import { PieceMesh } from './piece-mesh'

export function Ground() {
  const site = useWalk((s) => s.inspection?.site !== false)
  const gl = useThree((state) => state.gl)
  const doc = useDocument((state) => state.doc)
  const holes = useMemo(
    () => excavations(doc).map((ring) => ring.map((p) => ({ x: p.x, z: -p.y }))),
    [doc],
  )
  const native = useNativeGeometry({ kind: 'ground', holes })
  const geometry = useMemo(
    () => (native.geometry ? paintGround(native.geometry.clone()) : null),
    [native.geometry],
  )
  useEffect(() => () => geometry?.dispose(), [geometry])
  const grass = useMemo(() => {
    const texture = groundTexture()
    texture.anisotropy = gl.capabilities.getMaxAnisotropy()
    return texture
  }, [gl])
  useEffect(() => () => grass.dispose(), [grass])
  const material = useMemo(
    () => new MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 1, metalness: 0 }),
    [grass],
  )
  useEffect(() => () => material.dispose(), [material])

  if (!site || !geometry) return null
  return (
    <PieceMesh
      native={{ id: 'terrain:ground', elevation: 0, category: 'IFCGEOGRAPHICELEMENT' }}
      geometry={geometry}
      geometryKey={native.key}
      material={material}
      rotation={[-Math.PI / 2, 0, 0, 'YXZ']}
      at={[0, -0.01, 0]}
      shadows={false}
    />
  )
}
