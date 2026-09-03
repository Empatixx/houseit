import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EYE } from '../../store/walk'
import { MM } from '../plan-coordinates'
import { Floors } from './floors'
import { Furniture } from './furniture'
import { Walker } from './walker'
import { Walls } from './walls'

/**
 * The plan walked through: one perspective camera at eye height, lit from
 * above so the walls turn with the light, over the same floors, walls and
 * furniture the plan draws — the document is the one thing, and this is
 * another way of looking at it. Nothing is dragged here; a click picks.
 */
export function WalkScene() {
  return (
    <Canvas flat dpr={[1, 2]}>
      <PerspectiveCamera makeDefault fov={70} near={0.05} far={300} position={[0, EYE * MM, 0]} />
      <color attach="background" args={['#e9edf2']} />
      <hemisphereLight args={['#ffffff', '#c9ccd2', 2.2]} />
      <directionalLight position={[8, 20, 6]} intensity={1.3} />
      <directionalLight position={[-10, 12, -8]} intensity={0.6} />
      <Floors />
      <Walls />
      <Furniture />
      <Walker />
    </Canvas>
  )
}
