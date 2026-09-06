import { levelsOf } from '@houseit/core/levels'
import type { Spot } from '@houseit/geometry/standing'
import { PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { MM } from '../scene/plan-coordinates'
import { Ceilings, Floors } from '../scene/walk/floors'
import { Furniture } from '../scene/walk/furniture'
import { Walls } from '../scene/walk/walls'
import { usePlanDoc } from '../store/store'
import { EYE } from '../store/walk'

const FOV = 70

type CameraViewProps = {
  spot: Spot
  level: string
  onReady: (seen: () => string | undefined) => void
}

export function CameraView({ spot, level, onReady }: CameraViewProps) {
  const doc = usePlanDoc()
  const storeys = levelsOf(doc)
  const floor = storeys.find((storey) => storey.id === level)?.elevation ?? 0

  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted">
      <Canvas flat dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
        <PerspectiveCamera makeDefault fov={FOV} near={0.05} far={300} />
        <Eye spot={spot} floor={floor} onReady={onReady} />
        <color attach="background" args={['#e9edf2']} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 2.2]} />
        <directionalLight position={[8, 20, 6]} intensity={1.3} />
        <directionalLight position={[-10, 12, -8]} intensity={0.6} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial color="#dfe3e8" />
        </mesh>
        {storeys.map((storey) => (
          <group key={storey.id} position={[0, storey.elevation * MM, 0]}>
            <Floors level={storey.id} />
            <Ceilings level={storey.id} />
            <Walls level={storey.id} />
            <Furniture level={storey.id} />
          </group>
        ))}
      </Canvas>
    </div>
  )
}

function Eye({
  spot,
  floor,
  onReady,
}: {
  spot: Spot
  floor: number
  onReady: CameraViewProps['onReady']
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    camera.position.set(spot.at.x * MM, (floor + EYE) * MM, -spot.at.y * MM)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(0, spot.turn, 0)
    camera.updateProjectionMatrix()
  }, [camera, spot, floor])

  useEffect(() => {
    onReady(() => gl.domElement.toDataURL('image/jpeg', 0.85))
  }, [gl, onReady])

  return null
}
