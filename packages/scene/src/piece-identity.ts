import type { HouseDocument } from '@houseit/core/document'
import { geometryEntityKey, openingCategory } from '@houseit/core/entity-key'
import type { Piece } from './pieces'

const categories: Record<NonNullable<Piece['role']>, string> = {
  'wall-solid': 'IFCWALL',
  'floor-surface': 'IFCCOVERING',
  'slab-solid': 'IFCSLAB',
  'stair-solid': 'IFCSTAIR',
  'ramp-solid': 'IFCRAMP',
  'shaft-solid': 'IFCBUILDINGELEMENTPROXY',
  'roof-solid': 'IFCROOF',
  'column-solid': 'IFCCOLUMN',
  'facade-covering': 'IFCCOVERING',
  'site-surface': 'IFCGEOGRAPHICELEMENT',
  'site-marking': 'IFCSURFACEFEATURE',
  'site-railing': 'IFCRAILING',
}

export function pieceIdentity(piece: Piece, doc: HouseDocument, level?: string) {
  const category = piece.role
    ? categories[piece.role]
    : piece.entity?.startsWith('elements:')
      ? 'IFCWALL'
      : piece.of?.kind === 'opening'
        ? openingCategory(doc.openings[piece.of.id]!.kind)
        : 'IFCFURNISHINGELEMENT'
  const owner = piece.of
    ? `${{ room: 'rooms', wall: 'walls', object: 'objects', opening: 'openings' }[piece.of.kind]}:${piece.of.id}`
    : level
      ? `levels:${level}`
      : 'terrain'
  const physical =
    piece.role === 'floor-surface' ||
    piece.role === 'slab-solid' ||
    piece.role === 'facade-covering' ||
    piece.of?.kind === 'opening' ||
    (piece.role === 'stair-solid' && piece.of?.kind === 'object')
  return {
    category,
    entity: piece.entity ?? (physical ? geometryEntityKey(category, owner) : owner),
  }
}
