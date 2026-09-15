import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { FragmentDisplayLayer } from '../engine/fragment-display-layer'
import { NativeToolsLayer } from '../engine/native-tools-layer'
import { useEngineView } from '../store/engine-view'
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
import { Site } from './site'
import { SiteLayer } from './site-layer'
import { Spinning } from './spinning'
import { StairRuns } from './stair-runs'
import { StairsBelow } from './stairs-below'
import { StoreyBelow } from './storey-below'
import { House } from './three/house'
import { Lighting } from './three/lighting'
import { Walls } from './walls'
import { Zooming } from './zooming'

const OVERHEAD: [number, number, number] = [0, 40, 0]
const UP: [number, number, number] = [0, 0, -1]

export function PlanScene() {
  const view = useEngineView((state) => state.view)
  const measuring = useEngineView((state) => state.measure !== 'none')
  const armed = useTool((state) => state.armed)
  const shown = useShown((state) => state.shown)
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      style={{ cursor: armed ? 'crosshair' : 'default' }}
      onPointerMissed={() => {
        if (!measuring) selectionStore.getState().select(null)
      }}
    >
      <FragmentDisplayLayer>
        <OrthographicCamera
          makeDefault
          position={OVERHEAD}
          zoom={45}
          up={UP}
          near={0.1}
          far={200}
        />
        <OrbitControls
          makeDefault
          enabled={view === 'plan' && !measuring}
          enableRotate={false}
          enableDamping={false}
        />

        <color attach="background" args={['#f4f4f5']} />

        {view === 'plan' ? (
          <>
            {shown.grid ? <DotGrid /> : null}
            <Site />
            <SiteLayer />

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
          </>
        ) : (
          <>
            <Lighting />
            <House />
          </>
        )}
        <NativeToolsLayer />
        {view === 'plan' ? (
          <>
            <Zooming />
            <Spinning />
          </>
        ) : null}
      </FragmentDisplayLayer>
    </Canvas>
  )
}
