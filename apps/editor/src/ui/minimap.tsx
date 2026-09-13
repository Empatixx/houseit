import { planExtent } from '@houseit/geometry/dimensions'
import { OrthographicCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Shape } from 'three'
import { FragmentDisplayLayer } from '../engine/fragment-display-layer'
import { Furniture } from '../scene/furniture/furniture'
import { Plain } from '../scene/plain'
import { MM, toWorld } from '../scene/plan-coordinates'
import { RoomFloors } from '../scene/room-floors'
import { Walls } from '../scene/walls'
import { useDocument, usePlanDoc } from '../store/store'
import { useWalk, walkStore } from '../store/walk'

const VIOLET = '#714cb6'
const MARGIN = 600
const REACH = 3000
const OVER = 5000

const WIDTH = 208
const UP: [number, number, number] = [0, 0, -1]

type Fit = { x: number; z: number; zoom: number }

export function Minimap() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  const extent = planExtent(doc, level)
  if (!extent) return null

  const box = {
    x0: extent.x0 - MARGIN,
    y0: extent.y0 - MARGIN,
    x1: extent.x1 + MARGIN,
    y1: extent.y1 + MARGIN,
  }
  const width = WIDTH
  const height = Math.max(
    96,
    Math.min(176, Math.round((width * (box.y1 - box.y0)) / (box.x1 - box.x0))),
  )
  const fit: Fit = {
    x: ((box.x0 + box.x1) / 2) * MM,
    z: -((box.y0 + box.y1) / 2) * MM,
    zoom: Math.min(width / ((box.x1 - box.x0) * MM), height / ((box.y1 - box.y0) * MM)),
  }

  return (
    <div className="glass pointer-events-auto rounded-xl border p-1.5">
      <div
        role="button"
        tabIndex={0}
        aria-label="Where you stand on the plan; click to go there"
        style={{ width, height }}
        className="relative cursor-crosshair overflow-hidden rounded-md"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const dx = event.clientX - rect.left - width / 2
          const dy = event.clientY - rect.top - height / 2
          walkStore.getState().step({
            x: Math.round((fit.x + dx / fit.zoom) / MM),
            y: Math.round(-(fit.z + dy / fit.zoom) / MM),
          })
        }}
      >
        <Canvas flat dpr={[1, 2]} style={{ pointerEvents: 'none' }}>
          <FragmentDisplayLayer>
            <OrthographicCamera
              makeDefault
              position={[fit.x, 40, fit.z]}
              up={UP}
              near={0.1}
              far={200}
            />
            <Overhead fit={fit} />
            <color attach="background" args={['#f4f4f5']} />
            <Plain value={true}>
              <RoomFloors />
              <Furniture />
              <Walls />
            </Plain>
            <Standing />
          </FragmentDisplayLayer>
        </Canvas>
      </div>
    </div>
  )
}

function Overhead({ fit }: { fit: Fit }) {
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    if (camera.type !== 'OrthographicCamera') return
    camera.up.set(...UP)
    camera.position.set(fit.x, 40, fit.z)
    camera.lookAt(fit.x, 0, fit.z)
    ;(camera as { zoom: number }).zoom = fit.zoom
    camera.updateProjectionMatrix()
  }, [camera, fit])
  return null
}

function Standing() {
  const walker = useWalk((state) => state.walker)
  const fov = useWalk((state) => state.fov)

  const wedge = useMemo(() => {
    const half = (fov * Math.PI) / 360
    const shape = new Shape()
    shape.moveTo(0, 0)
    const steps = 12
    for (let i = 0; i <= steps; i += 1) {
      const angle = -half + (2 * half * i) / steps
      shape.lineTo(Math.sin(angle) * REACH * MM, Math.cos(angle) * REACH * MM)
    }
    shape.closePath()
    return shape
  }, [fov])

  if (!walker) return null
  return (
    <group position={toWorld(walker.at.x, walker.at.y, OVER)}>
      <mesh rotation={[-Math.PI / 2, 0, -walker.yaw]}>
        <shapeGeometry args={[wedge]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.22, 24]} />
        <meshBasicMaterial color={VIOLET} />
      </mesh>
    </group>
  )
}
