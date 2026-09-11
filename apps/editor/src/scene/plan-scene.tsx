import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { selectionStore } from '../store/selection'
import { useShown } from '../store/shown'
import { useTool } from '../store/tool'
import { Columns } from './columns'
import { Dimensions } from './dimensions'
import { DotGrid } from './dot-grid'
import { Drawing } from './drawing'
import { FitToPlan } from './fit-to-plan'
import { Furniture } from './furniture/furniture'
import { PlanPicture } from './plan-picture'
import { Ramps } from './ramps'
import { RoomAnnotations } from './room-annotations'
import { RoomFloors } from './room-floors'
import { Shafts } from './shafts'
import { Spinning } from './spinning'
import { StairRuns } from './stair-runs'
import { StairsBelow } from './stairs-below'
import { StoreyBelow } from './storey-below'
import { Walls } from './walls'
import { Zooming } from './zooming'

const OVERHEAD: [number, number, number] = [0, 40, 0]
const UP: [number, number, number] = [0, 0, -1]

export function PlanScene() {
  const armed = useTool((state) => state.armed)
  const shown = useShown((state) => state.shown)
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

      {shown.grid ? <DotGrid /> : null}

      {shown.below ? <StoreyBelow /> : null}
      {shown.below ? <StairsBelow /> : null}
      {shown.floors ? <RoomFloors /> : null}
      {shown.furniture ? <Furniture /> : null}
      <Walls />
      <Columns />
      <Shafts />
      <StairRuns />
      <Ramps />
      {shown.labels ? <RoomAnnotations /> : null}
      <Dimensions />
      <Drawing />
      <FitToPlan />
      <PlanPicture />
      <Zooming />
      <Spinning />
    </Canvas>
  )
}
