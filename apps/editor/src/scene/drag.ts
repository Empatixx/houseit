import type { Point } from '@houseit/geometry/outlines'
import { Plane, type Ray, Vector3 } from 'three'
import { MM } from './plan-coordinates'

const GROUND = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()

export function pointOnPlan(ray: Ray): Point | undefined {
  if (!ray.intersectPlane(GROUND, hit)) return undefined
  return { x: hit.x / MM, y: -hit.z / MM }
}

export const dragged = (event: { delta: number }) => event.delta > 4
