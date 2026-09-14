import type { Body, Piece } from '@houseit/scene/pieces'
import type { GeometryInput } from './geometry-protocol'
import { rectangleSheet } from './sheet-geometry'

export function pieceInput(body: Exclude<Body, { kind: 'model' }>): GeometryInput {
  switch (body.kind) {
    case 'prism':
    case 'sheet':
      return { kind: 'profile', body }
    case 'symbol':
      return rectangleSheet(body)
    default:
      return { kind: 'primitive', body }
  }
}

export function piecePlacement(piece: Piece) {
  const flat =
    piece.body.kind === 'prism' || piece.body.kind === 'sheet' || piece.body.kind === 'symbol'
  return {
    at: [
      piece.at.x / 1000,
      (piece.at.y - (piece.body.kind === 'prism' ? piece.body.thickness / 2 : 0)) / 1000,
      piece.at.z / 1000,
    ] as [number, number, number],
    rotation: [
      (piece.tilt ?? 0) - (flat ? Math.PI / 2 : 0),
      piece.turn ?? 0,
      (piece.roll ?? 0) + (piece.body.kind === 'symbol' ? Math.PI : 0),
      'YXZ',
    ] as [number, number, number, 'YXZ'],
  }
}
