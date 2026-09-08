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

export type World = {
  storeys: Storey[]
}

export function storeyOf(doc: HouseDocument, level: string): Piece[] {
  return [
    ...floorPieces(doc, level),
    ...ceilingPieces(doc, level),
    ...wallPieces(doc, level),
    ...furniturePieces(doc, level),
  ]
}

export function worldOf(doc: HouseDocument): World {
  return {
    storeys: levelsOf(doc).map((storey) => ({
      level: storey.id,
      elevation: storey.elevation,
      pieces: storeyOf(doc, storey.id),
    })),
  }
}
