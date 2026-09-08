import { levelsOf } from '@houseit/core/levels'
import type { Spot } from '@houseit/geometry/standing'
import { PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { MM } from '../scene/plan-coordinates'
import { House } from '../scene/three/house'
import { Ground, Lighting, SKY } from '../scene/three/lighting'
import { Shading } from '../scene/three/shading'
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
  const floor = levelsOf(doc).find((storey) => storey.id === level)?.elevation ?? 0

  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted">
      <Canvas flat shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
        <PerspectiveCamera makeDefault fov={FOV} near={0.05} far={300} />
        <Eye spot={spot} floor={floor} onReady={onReady} />
        <color attach="background" args={[SKY]} />
        <Lighting />
        <Ground />
        <House picking={false} />
        <Shading />
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
