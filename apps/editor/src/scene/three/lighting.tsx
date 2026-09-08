import { reachOf } from '@houseit/scene/world'
import { useMemo } from 'react'
import { usePlanDoc } from '../../store/store'
import { MM } from '../plan-coordinates'

export const SKY = '#e9edf2'
const GROUND = '#dfe3e8'

const OVERHEAD = { x: -0.55, y: 1, z: 0.75 }
const MARGIN = 6000

export function Lighting() {
  const doc = usePlanDoc()
  const sun = useMemo(() => {
    const reach = reachOf(doc)
    const across = Math.max(reach.max.x - reach.min.x, reach.max.z - reach.min.z) + MARGIN
    const middle = {
      x: (reach.min.x + reach.max.x) / 2,
      z: (reach.min.z + reach.max.z) / 2,
    }
    return {
      at: [
        (middle.x + OVERHEAD.x * across) * MM,
        OVERHEAD.y * across * MM,
        (middle.z + OVERHEAD.z * across) * MM,
      ] as [number, number, number],
      aim: [middle.x * MM, 0, middle.z * MM] as [number, number, number],
      half: (across * MM) / 1.4,
      far: across * MM * 3,
    }
  }, [doc])

  return (
    <>
      <hemisphereLight args={['#dce7f2', '#b9bcc2', 0.5]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        castShadow
        position={sun.at}
        target-position={sun.aim}
        intensity={3.2}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={sun.far}
        shadow-camera-left={-sun.half}
        shadow-camera-right={sun.half}
        shadow-camera-top={sun.half}
        shadow-camera-bottom={-sun.half}
      />
      <directionalLight position={[10, 12, -8]} intensity={0.22} />
    </>
  )
}

export function Ground() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color={GROUND} roughness={1} />
    </mesh>
  )
}
