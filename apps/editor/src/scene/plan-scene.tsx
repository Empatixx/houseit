import { Grid, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { FitToPlan } from './fit-to-plan'
import { RoomAnnotations } from './room-annotations'
import { RoomFloors } from './room-floors'
import type { ViewMode } from './view-mode'
import { Walls } from './walls'

/**
 * Both views are the same scene; only the camera moves. That is the whole reason
 * the renderer is three.js rather than a 2D canvas — walls, and later sockets and
 * cable runs, are authored once and appear in both.
 */
export function PlanScene({ view, fitKey }: { view: ViewMode; fitKey: number }) {
  return (
    <Canvas flat shadows dpr={[1, 2]}>
      {view === 'plan' ? (
        <OrthographicCamera
          makeDefault
          position={[0, 40, 0]}
          zoom={45}
          up={[0, 0, -1]}
          near={0.1}
          far={200}
        />
      ) : (
        <PerspectiveCamera makeDefault position={[12, 10, 12]} fov={45} near={0.1} far={500} />
      )}
      <OrbitControls
        makeDefault
        enableRotate={view === 'perspective'}
        enableDamping={false}
        target={[0, 0, 0]}
      />

      <color attach="background" args={['#f4f4f5']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 20, 6]} intensity={1.1} castShadow />

      <Grid
        position={[0, -0.05, 0]}
        args={[200, 200]}
        cellSize={1}
        cellColor="#e4e4e7"
        sectionSize={5}
        sectionColor="#d4d4d8"
        infiniteGrid
        fadeDistance={90}
        followCamera={false}
      />

      <RoomFloors />
      <Walls view={view} />
      <RoomAnnotations />
      {view === 'plan' ? <FitToPlan fitKey={fitKey} /> : null}
    </Canvas>
  )
}
