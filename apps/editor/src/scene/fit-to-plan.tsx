import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { OrthographicCamera, Vector3 } from 'three'
import { useDocument } from '../store/store'
import { clearOf, useView, type ViewBox, viewStore } from '../store/view'
import { MM } from './plan-coordinates'

type Controls = { target: Vector3; update: () => void }

/** Room left round the plan: enough for the overall dimensions drawn outside it. */
const PADDING = 0.84
/** Round a box asked for by name, which brings its own margin with it. */
const BOX_PADDING = 0.96

/** Where the plan was framed to, so the framing can be held for a moment. */
type Framing = { x: number; z: number; zoom: number; until: number }

/**
 * How long a fresh framing is held against whatever else moves the camera.
 *
 * Long enough for every effect that runs at start-up to have had its say —
 * the controls being recreated for the camera that arrives a beat later, the
 * canvas being measured for real — and short enough that somebody panning a
 * moment after a Fit is not fought.
 */
const HOLD = 800

/**
 * Frames the plan, or whatever box was asked for. Runs once when geometry first
 * appears and then only when asked — refitting on every edit would fight
 * whoever is panning.
 */
export function FitToPlan() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const box = useView((state) => state.box)
  const fitKey = useView((state) => state.asked)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as Controls | null
  const size = useThree((state) => state.size)
  const framed = useRef('')
  const held = useRef<Framing | null>(null)

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

    const target = box ?? planBox(doc, level)
    if (!target) return

    const centreX = ((target.x0 + target.x1) / 2) * MM
    const centreZ = -((target.y0 + target.y1) / 2) * MM
    const width = Math.max(target.x1 - target.x0, 1) * MM
    const height = Math.max(target.y1 - target.y0, 1) * MM
    const padding = box ? BOX_PADDING : PADDING

    // Into the part of the canvas nothing floats over — the panel down the
    // right side would otherwise hide a wall or two — read as it is now rather
    // than watched: the panel folding away is not a reason to move the plan.
    const clear = clearOf(viewStore.getState().covers, size)
    const zoom = padding * Math.min(clear.width / width, clear.height / height)
    // The plan's middle goes to the middle of that part, which is so many
    // pixels right of and below the middle of the canvas; the camera looks
    // that far the other way. A pixel is 1/zoom of a metre, and screen down
    // is +z.
    const dx = clear.x + clear.width / 2 - size.width / 2
    const dy = clear.y + clear.height / 2 - size.height / 2
    const x = centreX - dx / zoom
    const z = centreZ - dy / zoom

    frame(camera as OrthographicCamera, controls, { x, z, zoom })
    // Held for a moment. On a reload the controls' target went back to the origin
    // after this ran — the camera stayed over the middle of the plan and looked
    // at its corner, which showed the walls from the side — and nothing in this
    // effect's inputs changed to say so. Holding the framing for a few frames
    // puts it right whatever undid it.
    held.current = { x, z, zoom, until: performance.now() + HOLD }
    framed.current = asked
  }, [doc, level, box, camera, controls, size, fitKey])

  // After the controls have run for the frame, so what they undid is redone: the
  // controls update at a priority below zero, and this runs at the default. (A
  // priority above zero would take over the render loop, and nothing is drawn.)
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

/** The box round every wall of the level, or nothing while there are none. */
function planBox(
  doc: {
    walls: Record<string, { level: string; a: string; b: string }>
    nodes: Record<string, { x: number; y: number } | undefined>
  },
  level: string,
): ViewBox | undefined {
  const nodes = Object.values(doc.walls)
    .filter((wall) => wall.level === level)
    .flatMap((wall) => [doc.nodes[wall.a], doc.nodes[wall.b]])
    .filter((node) => node !== undefined)
  if (nodes.length === 0) return undefined

  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Puts the camera straight over a point, looking down at it, at a zoom. */
function frame(
  camera: OrthographicCamera,
  controls: Controls,
  to: { x: number; z: number; zoom: number },
) {
  controls.target.set(to.x, 0, to.z)
  camera.position.set(to.x, camera.position.y, to.z)
  controls.update()
  // Set the zoom after the controls have run: their update() writes camera.zoom
  // for an orthographic camera and would otherwise undo this.
  camera.zoom = to.zoom
  camera.updateProjectionMatrix()
}
