import type { Point } from '@houseit/geometry/outlines'
import { Plane, type Ray, Vector3 } from 'three'
import { MM } from '../plan-coordinates'

/** The floor of the plan: everything dragged is dragged along it. */
const GROUND = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()

/** Where the pointer is on the plan, in millimetres, or nothing if it points off it. */
export function pointOnPlan(ray: Ray): Point | undefined {
  if (!ray.intersectPlane(GROUND, hit)) return undefined
  return { x: hit.x / MM, y: -hit.z / MM }
}

/** Whether the pointer moved far enough since it went down to be a drag, not a click. */
export const dragged = (event: { delta: number }) => event.delta > 4
