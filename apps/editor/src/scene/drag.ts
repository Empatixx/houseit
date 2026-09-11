import type { Point } from '@houseit/geometry/outlines'
import { type Camera, Plane, type Ray, Raycaster, Vector2, Vector3 } from 'three'
import { MM } from './plan-coordinates'

const GROUND = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()

export function pointOnPlan(ray: Ray): Point | undefined {
  if (!ray.intersectPlane(GROUND, hit)) return undefined
  return { x: hit.x / MM, y: -hit.z / MM }
}

const caster = new Raycaster()
const screen = new Vector2()

export function pointUnder(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  camera: Camera,
): Point | undefined {
  const box = canvas.getBoundingClientRect()
  if (box.width === 0 || box.height === 0) return undefined
  screen.set(
    ((event.clientX - box.left) / box.width) * 2 - 1,
    -((event.clientY - box.top) / box.height) * 2 + 1,
  )
  caster.setFromCamera(screen, camera)
  return pointOnPlan(caster.ray)
}

export const dragged = (event: { delta: number }) => event.delta > 4
