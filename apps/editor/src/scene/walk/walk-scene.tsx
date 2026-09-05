import { levelsOf } from '@houseit/core/levels'
import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { usePlanDoc } from '../../store/store'
import { EYE } from '../../store/walk'
import { MM } from '../plan-coordinates'
import { Floors } from './floors'
import { Furniture } from './furniture'
import { Walker } from './walker'
import { Walls } from './walls'

/**
 * The house walked through: one perspective camera at eye height, lit from
 * above so the walls turn with the light, over the same floors, walls and
 * furniture the plan draws — the document is the one thing, and this is another
 * way of looking at it. Nothing is dragged here; a click picks.
 *
 * The whole house, every storey of it, each at the height it really stands at,
 * because a house is not one floor at a time once you are inside it: the stairs
 * out of the hall have to arrive somewhere, and the hole they come up through
 * has to show the room above. Which storey you are standing on is the storey
 * the plan has open, so the cards at the corner take you up and down.
 */
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
      {/* The ground the house stands on, so a window looks out on something. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#dfe3e8" />
      </mesh>
      {storeys.map((storey) => (
        <group key={storey.id} position={[0, storey.elevation * MM, 0]}>
          <Floors level={storey.id} />
          <Walls level={storey.id} />
          <Furniture level={storey.id} />
        </group>
      ))}
      <Walker />
    </Canvas>
  )
}
