import type { HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { reachOf } from '@houseit/scene/world'

export type BuildingView = 'north' | 'south' | 'east' | 'west' | 'roof' | 'overview'

export function buildingView(doc: HouseDocument, view: BuildingView) {
  const bounds = reachOf(view === 'overview' ? doc : { ...doc, site: undefined })
  const levels = levelsOf(doc)
  const low = Math.min(...levels.map((l) => l.elevation)) / 1000
  const high =
    Math.max(
      ...levels.map(
        (l) =>
          l.elevation +
          l.height +
          Math.max(
            0,
            ...(l.roofs ?? []).map(
              (r) => (r.baseOffset ?? 0) + r.parapet.height + (r.parapet.coping ?? 20),
            ),
          ),
      ),
    ) / 1000
  const centre: [number, number, number] = [
    (bounds.min.x + bounds.max.x) / 2000,
    (low + high) / 2,
    (bounds.min.z + bounds.max.z) / 2000,
  ]
  const span =
    Math.max(
      (bounds.max.x - bounds.min.x) / 1000,
      (bounds.max.z - bounds.min.z) / 1000,
      high - low,
    ) *
      1.25 +
    2
  const directions = {
    north: [0, 0, -1],
    south: [0, 0, 1],
    east: [1, 0, 0],
    west: [-1, 0, 0],
    roof: [0, 1, 0],
    overview: [0.8, 0.65, 1],
  } as const
  const direction = directions[view]
  return {
    at: centre.map((v, i) => v + direction[i]! * span) as [number, number, number],
    target: centre,
    span,
    orthographic: view !== 'overview',
  }
}
