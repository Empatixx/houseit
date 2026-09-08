import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EYE } from '../../store/walk'
import { MM } from '../plan-coordinates'
import { Ground } from '../three/ground'
import { House } from '../three/house'
import { Lighting, SKY } from '../three/lighting'
import { Shading } from '../three/shading'
import { Walker } from './walker'

export function WalkScene() {
  return (
    <Canvas flat shadows dpr={[1, 2]}>
      <PerspectiveCamera makeDefault fov={70} near={0.05} far={300} position={[0, EYE * MM, 0]} />
      <color attach="background" args={[SKY]} />
      <Lighting />
      <Ground />
      <House />
      <Walker />
      <Shading />
    </Canvas>
  )
}
