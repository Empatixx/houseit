import { Grid, OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { selectionStore } from '../store/selection'
import { useTool } from '../store/tool'
import { Dimensions } from './dimensions'
import { FitToPlan } from './fit-to-plan'
import { Furniture } from './furniture/furniture'
import { RoomAnnotations } from './room-annotations'
import { RoomFloors } from './room-floors'
import { Walls } from './walls'

/**
 * The plan: one orthographic camera looking straight down.
 *
 * There was a second camera here once, and there will be again — the model still
 * carries the heights a perspective view needs, a table top at 740 and a seat at
 * 420, and the parts a plan never shows, like a table's legs. What was deleted is
 * the view, not the knowledge behind it.
 */
/**
 * Where the camera starts, held still on purpose.
 *
 * Written inline these would be a fresh array on every render, which react-three
 * would dutifully apply again — putting the camera back where it started every
 * time anything changed, and quietly undoing whatever framed the plan.
 */
const OVERHEAD: [number, number, number] = [0, 40, 0]
const UP: [number, number, number] = [0, 0, -1]

export function PlanScene() {
  const armed = useTool((state) => state.armed)
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      style={{ cursor: armed ? 'crosshair' : 'default' }}
      onPointerMissed={() => selectionStore.getState().select(null)}
    >
      <OrthographicCamera makeDefault position={OVERHEAD} zoom={45} up={UP} near={0.1} far={200} />
      <OrbitControls makeDefault enableRotate={false} enableDamping={false} />

      <color attach="background" args={['#f4f4f5']} />

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
      <Furniture />
      <Walls />
      <RoomAnnotations />
      <Dimensions />
      <FitToPlan />
    </Canvas>
  )
}
