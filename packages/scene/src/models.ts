import { modelFileOf } from '@houseit/core/imported'
import { mediaUnit, plainBox } from './models/bedroom'
import type { Builder, Part } from './models/builder'
import { column, railing } from './models/fittings'
import { dining } from './models/seating'
import { staircase } from './models/stairs'
import { model, type Piece } from './pieces'

const BUILDERS: Record<string, Builder> = {
  box: plainBox,
  'media-unit': mediaUnit,
  'outdoor-dining': dining(2, 1),
  'dining-round-4': dining(1, 1, true),
  'dining-square-4': dining(1, 1),
  'dining-6': dining(2, 1),
  'dining-8': dining(3, 1),
  'dining-square-8': dining(2, 2),
  'stairs-straight': staircase('straight'),
  'stairs-u': staircase('u'),
  'stairs-l-landing': staircase('l-landing'),
  'stairs-l-winder': staircase('l-winder'),
  'stairs-spiral': staircase('spiral'),
  column,
  post: column,
  railing,
}

export const modelled = (type: string): boolean =>
  type in BUILDERS || modelFileOf(type) !== undefined

export function piecesOf(type: string, part: Part): Piece[] {
  const file = modelFileOf(type)
  if (file) return [model({ file, w: part.w, h: part.h, d: part.d, paint: part.body })]
  return BUILDERS[type]?.(part) ?? []
}
