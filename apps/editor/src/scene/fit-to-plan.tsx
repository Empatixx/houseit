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
  const camera = useThree((state) => state.camera) as OrthographicCamera
  const controls = useThree((state) => state.controls) as Controls | null
  const size = useThree((state) => state.size)
  const framed = useRef(0)

  useEffect(() => {
    if (framed.current === fitKey && framed.current !== 0) return

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

    camera.position.set(centreX, camera.position.y, centreZ)
    controls?.target.set(centreX, 0, centreZ)
    controls?.update()

    // Set the zoom after the controls have run: their update() writes camera.zoom
    // for an orthographic camera and would otherwise undo this.
    camera.zoom = PADDING * Math.min(size.width / width, size.height / height)
    camera.updateProjectionMatrix()
    framed.current = fitKey
  }, [doc, level, camera, controls, size, fitKey])

  return null
}
