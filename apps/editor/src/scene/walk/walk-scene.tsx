import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { NativeToolsLayer } from '../../engine/native-tools-layer'
import { EYE, useWalk } from '../../store/walk'
import { MM } from '../plan-coordinates'
import { Ground } from '../three/ground'
import { House } from '../three/house'
import { Lighting } from '../three/lighting'
import { Shading } from '../three/shading'
import { Sky } from '../three/sky'
import { Walker } from './walker'

export function WalkScene() {
  const inspection = useWalk((state) => state.inspection)
  return (
    <Canvas flat shadows dpr={[1, 2]}>
      {inspection?.orthographic ? (
        <OrthographicCamera makeDefault near={0.05} far={1000} position={[0, EYE * MM, 0]} />
      ) : (
        <PerspectiveCamera
          makeDefault
          fov={70}
          near={0.05}
          far={1000}
          position={[0, EYE * MM, 0]}
        />
      )}
      <Sky />
      <Lighting />
      <Ground />
      <House picking={false} />
      <Walker />
      <Shading />
      <NativeToolsLayer sections={false} />
    </Canvas>
  )
}
