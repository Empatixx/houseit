import type { HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { ceilingPieces, floorPieces } from './floors'
import { furniturePieces } from './furniture'
import type { Piece } from './pieces'
import { wallPieces } from './walls'

export type Storey = {
  level: string
  elevation: number
  pieces: Piece[]
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
    ...floorPieces(doc, level),
    ...ceilingPieces(doc, level),
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
    })),
  }
}
