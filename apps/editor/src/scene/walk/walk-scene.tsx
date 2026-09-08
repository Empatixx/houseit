import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EYE } from '../../store/walk'
import { MM } from '../plan-coordinates'
import { Ground } from '../three/ground'
import { House } from '../three/house'
import { Lighting } from '../three/lighting'
import { Shading } from '../three/shading'
import { Sky } from '../three/sky'
import { Walker } from './walker'

export function WalkScene() {
  return (
    <Canvas flat shadows dpr={[1, 2]}>
      <PerspectiveCamera makeDefault fov={70} near={0.05} far={300} position={[0, EYE * MM, 0]} />
      <Sky />
      <Lighting />
      <Ground />
      <House />
      <Walker />
      <Shading />
    </Canvas>
  )
}
