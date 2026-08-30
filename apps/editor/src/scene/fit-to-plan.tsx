import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { OrthographicCamera, Vector3 } from 'three'
import { useDocument } from '../store/store'
import { MM } from './plan-coordinates'

type Controls = { target: Vector3; update: () => void }

const PADDING = 0.9

/**
 * Frames the plan. Runs once when geometry first appears and then only when the
 * Fit button asks — refitting on every edit would fight whoever is panning.
 */
export function FitToPlan({ fitKey }: { fitKey: number }) {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as Controls | null
  const size = useThree((state) => state.size)
  const framed = useRef('')

  useEffect(() => {
    // Keyed on the camera as well as the ask: a camera that arrives a beat later
    // would otherwise find the job already marked done and never be framed.
    if (camera.type !== 'OrthographicCamera') return
    // And nothing at all until the controls are here. They register a frame after
    // the camera does, and on arrival they pull the camera onto their own target,
    // which is the origin — so a plan framed before that lands back in the corner
    // of the screen, and only pressing Fit puts it right. Which is exactly what a
    // reload used to do.
    if (!controls) return
    // The canvas is measured too, because the first measurement is not the last:
    // the plan is framed against a canvas that has not been laid out yet, and the
    // real one arrives a moment later. Framed once and marked done, the plan ends
    // up sized for a window that was never there — which is what a reload looked
    // like. Refitting on a resize is the right answer anyway: a plan that stays
    // framed is what a plan is for.
    const asked = `${fitKey}-${camera.uuid}-${size.width}x${size.height}`
    if (framed.current === asked) return

    const nodes = Object.values(doc.walls)
      .filter((wall) => wall.level === level)
      .flatMap((wall) => [doc.nodes[wall.a], doc.nodes[wall.b]])
      .filter((node) => node !== undefined)
    if (nodes.length === 0) return

    const xs = nodes.map((node) => node.x)
    const ys = nodes.map((node) => node.y)
    const centreX = ((Math.min(...xs) + Math.max(...xs)) / 2) * MM
    const centreZ = -((Math.min(...ys) + Math.max(...ys)) / 2) * MM
    const width = Math.max(Math.max(...xs) - Math.min(...xs), 1) * MM
    const height = Math.max(Math.max(...ys) - Math.min(...ys), 1) * MM

    controls.target.set(centreX, 0, centreZ)

    camera.position.set(centreX, camera.position.y, centreZ)
    controls.update()
    // Set the zoom after the controls have run: their update() writes camera.zoom
    // for an orthographic camera and would otherwise undo this.
    const overhead = camera as OrthographicCamera
    overhead.zoom = PADDING * Math.min(size.width / width, size.height / height)
    camera.updateProjectionMatrix()
    framed.current = asked
  }, [doc, level, camera, controls, size, fitKey])

  return null
}
