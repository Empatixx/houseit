import type { HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { type Light, lightsOn } from './lights'
import type { Piece } from './pieces'
import { piecesForModules } from './scene-module'
import { SCENE_MODULES } from './scene-modules'
import { sitePieces } from './site'

export type Storey = {
  level: string
  elevation: number
  pieces: Piece[]
  lights: Light[]
}

export type Reach = { min: { x: number; z: number }; max: { x: number; z: number } }

export type World = {
  storeys: Storey[]
  site: Piece[]
  bounds: Reach
}

const ALONE = 4000

export function reachOf(doc: HouseDocument): Reach {
  const nodes = Object.values(doc.nodes)
  if (doc.site?.surfaces.length)
    nodes.push(...doc.site.surfaces.flatMap((s) => s.outline.map((p) => ({ ...p, id: '' }))))
  if (nodes.length === 0) {
    return { min: { x: -ALONE, z: -ALONE }, max: { x: ALONE, z: ALONE } }
  }
  const xs = nodes.map((node) => node.x)
  const zs = nodes.map((node) => -node.y + 0)
  return {
    min: { x: Math.min(...xs), z: Math.min(...zs) },
    max: { x: Math.max(...xs), z: Math.max(...zs) },
  }
}

export function storeyOf(doc: HouseDocument, level: string): Piece[] {
  return piecesForModules(SCENE_MODULES, doc, level)
}

export function worldOf(doc: HouseDocument): World {
  return {
    bounds: reachOf(doc),
    site: sitePieces(doc),
    storeys: levelsOf(doc).map((storey) => ({
      level: storey.id,
      elevation: storey.elevation,
      pieces: storeyOf(doc, storey.id),
      lights: lightsOn(doc, storey.id),
    })),
  }
}
