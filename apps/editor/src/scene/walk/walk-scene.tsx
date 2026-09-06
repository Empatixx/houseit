import { levelsOf } from '@houseit/core/levels'
import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { usePlanDoc } from '../../store/store'
import { EYE } from '../../store/walk'
import { MM } from '../plan-coordinates'
import { Ceilings, Floors } from './floors'
import { Furniture } from './furniture'
import { Walker } from './walker'
import { Walls } from './walls'

export function WalkScene() {
  const doc = usePlanDoc()
  const storeys = levelsOf(doc)

  return (
    <Canvas flat dpr={[1, 2]}>
      <PerspectiveCamera makeDefault fov={70} near={0.05} far={300} position={[0, EYE * MM, 0]} />
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
      <Walker />
    </Canvas>
  )
}
