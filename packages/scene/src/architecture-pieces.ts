import type { HouseDocument } from '@houseit/core/document'
import { nestedEntityKey } from '@houseit/core/entity-key'
import { soffitOf } from '@houseit/core/levels'
import { connectionPieces } from './connections'
import { exposedBoxes } from './exposed-boxes'
import { ceilingPieces, floorPieces, underfloorPieces } from './floors'
import { furniturePieces } from './furniture'
import { type Piece, slab } from './pieces'
import { roofPieces } from './roofs'
import { wallPieces } from './walls'

export function architecturePieces(doc: HouseDocument, level: string): Piece[] {
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
