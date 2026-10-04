import { SYMBOL_FOOTPRINTS } from './footprints'
import { importedType } from './imported'

export type Part = { x0: number; y0: number; x1: number; y1: number }

const WHOLE: readonly Part[] = [{ x0: 0, y0: 0, x1: 1, y1: 1 }]

export const partsOf = (type: string): readonly Part[] =>
  SYMBOL_FOOTPRINTS[type] ?? importedType(type)?.parts ?? WHOLE

export const drawnPartsOf = (type: string): readonly Part[] =>
  importedType(type)?.overhangs ? WHOLE : partsOf(type)
