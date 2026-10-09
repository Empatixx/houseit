import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { type OrthographicCamera, Vector3 } from 'three'
import { useDocument } from '../store/store'
import { clearOf, useView, type ViewBox, viewStore } from '../store/view'
import { MM } from './plan-coordinates'

type Controls = { target: Vector3; update: () => void }

const PADDING = 0.84
const BOX_PADDING = 0.96

type Framing = { x: number; z: number; zoom: number; until: number }

const HOLD = 800

export function FitToPlan() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const box = useView((state) => state.box)
  const fitKey = useView((state) => state.asked)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as Controls | null
  const size = useThree((state) => state.size)
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const hook = (window as unknown as { __houseit?: Record<string, unknown> }).__houseit
    if (!hook) return
    hook.toScreen = (x: number, y: number, up = 0) => {
      const box = gl.domElement.getBoundingClientRect()
      const point = new Vector3(x * MM, up * MM, -y * MM).project(camera)
      return {
        x: box.left + ((point.x + 1) / 2) * box.width,
        y: box.top + ((1 - point.y) / 2) * box.height,
      }
    }
  }, [camera, gl])

  const framed = useRef('')
  const held = useRef<Framing | null>(null)

  useEffect(() => {
    if (camera.type !== 'OrthographicCamera') return
    if (!controls) return
    const asked = `${fitKey}-${camera.uuid}-${size.width}x${size.height}`
    if (framed.current === asked) return

    const target = box ?? planBox(doc, level)
    if (!target) return

    const centreX = ((target.x0 + target.x1) / 2) * MM
    const centreZ = -((target.y0 + target.y1) / 2) * MM
    const width = Math.max(target.x1 - target.x0, 1) * MM
    const height = Math.max(target.y1 - target.y0, 1) * MM
    const padding = box ? BOX_PADDING : PADDING

    const clear = clearOf(viewStore.getState().covers, size)
    const zoom = padding * Math.min(clear.width / width, clear.height / height)
    const dx = clear.x + clear.width / 2 - size.width / 2
    const dy = clear.y + clear.height / 2 - size.height / 2
    const x = centreX - dx / zoom
    const z = centreZ - dy / zoom

    frame(camera as OrthographicCamera, controls, { x, z, zoom })
    held.current = { x, z, zoom, until: performance.now() + HOLD }
    framed.current = asked
  }, [doc, level, box, camera, controls, size, fitKey])

  useFrame(() => {
    const wanted = held.current
    if (!wanted || !controls) return
    if (performance.now() > wanted.until) {
      held.current = null
      return
    }
    const overhead = camera as OrthographicCamera
    const moved =
      controls.target.x !== wanted.x ||
      controls.target.z !== wanted.z ||
      camera.position.x !== wanted.x ||
      camera.position.z !== wanted.z ||
      overhead.zoom !== wanted.zoom
    if (moved) frame(overhead, controls, wanted)
  })

  return null
}

function planBox(doc: HouseDocument, level: string): ViewBox | undefined {
  const nodes = Object.values(doc.walls)
    .filter((wall) => wall.level === level)
    .flatMap((wall) => [doc.nodes[wall.a], doc.nodes[wall.b]])
    .filter((node) => node !== undefined)
  const points = [...nodes, ...(doc.levels[level]?.ramps ?? []).flatMap((r) => rampOutline(r))]
  if (doc.levels[level]?.elevation === 0)
    points.push(
      ...(doc.site?.surfaces
        .filter((s) => s.name.startsWith('Parking '))
        .flatMap((s) => s.outline) ?? []),
    )
  if (points.length === 0) return undefined

  const xs = points.map((node) => node.x)
  const ys = points.map((node) => node.y)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

function frame(
  camera: OrthographicCamera,
  controls: Controls,
  to: { x: number; z: number; zoom: number },
) {
  controls.target.set(to.x, 0, to.z)
  camera.position.set(to.x, camera.position.y, to.z)
  controls.update()
  camera.zoom = to.zoom
  camera.updateProjectionMatrix()
}

import type { HouseDocument } from '@houseit/core/document'
import { rampOutline } from '@houseit/geometry/connections'
