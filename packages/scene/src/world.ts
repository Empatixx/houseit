import type { HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { connectionPieces } from './connections'
import { ceilingPieces, floorPieces } from './floors'
import { furniturePieces } from './furniture'
import { type Light, lightsOn } from './lights'
import { type Piece, slab } from './pieces'
import { roofPieces } from './roofs'
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
  bounds: Reach
}

const ALONE = 4000

export function reachOf(doc: HouseDocument): Reach {
  const nodes = Object.values(doc.nodes)
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
    ...(doc.levels[level]?.columns ?? []).map((column) => ({
      ...slab({
        x: column.x,
        z: -column.y,
        w: column.width,
        d: column.depth,
        h: doc.levels[level]!.height - (doc.levels[level]!.slabThickness ?? 250),
        paint: { colour: column.colour },
      }),
      name: `column-${column.id}`,
    })),
    ...connectionPieces(doc, level),
    ...floorPieces(doc, level),
    ...ceilingPieces(doc, level),
    ...roofPieces(doc, level),
    ...wallPieces(doc, level),
    ...furniturePieces(doc, level),
  ].map((piece, index) => (piece.name ? piece : { ...piece, name: `piece-${index}` }))
}

export function worldOf(doc: HouseDocument): World {
  return {
    bounds: reachOf(doc),
    storeys: levelsOf(doc).map((storey) => ({
      level: storey.id,
      elevation: storey.elevation,
      pieces: storeyOf(doc, storey.id),
      lights: lightsOn(doc, storey.id),
    })),
  }
}
