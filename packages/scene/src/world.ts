import type { HouseDocument } from '@houseit/core/document'
import { nestedEntityKey } from '@houseit/core/entity-key'
import { levelsOf } from '@houseit/core/levels'
import { connectionPieces } from './connections'
import { exposedBoxes } from './exposed-boxes'
import { ceilingPieces, floorPieces, underfloorPieces } from './floors'
import { furniturePieces } from './furniture'
import { type Light, lightsOn } from './lights'
import { type Piece, slab } from './pieces'
import { roofPieces } from './roofs'
import { sitePieces } from './site'
import { wallPieces } from './walls'

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
  return [
    ...exposedBoxes([
      ...(doc.levels[level]?.columns ?? []).map((column) => ({
        ...slab({
          x: column.x,
          z: -column.y,
          w: column.width,
          d: column.depth,
          h: soffitOf(doc.levels[level]!),
          paint: { colour: column.colour },
        }),
        name: `column-${column.id}`,
        entity: nestedEntityKey('columns', `levels:${level}`, column.id),
        role: 'column-solid' as const,
      })),
      ...connectionPieces(doc, level),
      ...wallPieces(doc, level),
      ...roofPieces(doc, level),
    ]),
    ...floorPieces(doc, level).map((p) => ({ ...p, role: 'floor-surface' as const })),
    ...underfloorPieces(doc, level).map((p) => ({ ...p, role: 'slab-solid' as const })),
    ...ceilingPieces(doc, level).map((p) => ({ ...p, role: 'slab-solid' as const })),
    ...furniturePieces(doc, level),
  ].map((piece, index) => (piece.name ? piece : { ...piece, name: `piece-${index}` }))
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

import { soffitOf } from '@houseit/core/levels'
