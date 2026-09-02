/**
 * The things that go in a room.
 *
 * A type is what something is and how big it usually is — never how it is drawn.
 * The drawing is a plan symbol under the editor's `symbols/` folder, and what
 * fills it is a surface from `surfaces.ts`; keeping the three apart is what lets
 * one `queen-bed` be white, linen or blue without there being three beds.
 *
 * The catalogue itself is the reference's, brought in by `scripts/import-catalog.mjs`
 * and kept as data in `catalog.ts`.
 */
import { CATALOG_OBJECT_TYPES } from './catalog'

export type ObjectType = {
  id: string
  label: string
  /** What it is if nobody says otherwise, in millimetres. */
  size: { width: number; depth: number }
  /** The surfaces this thing is ever finished in. */
  surfaces: readonly string[]
  /** Where it goes when no side is named. */
  stands: 'wall' | 'free'
  /** Places at a table. Ignored by everything without them. */
  seats?: number
  /**
   * Which layer of the room it takes up. Things only keep clear of things on their
   * own layer, and a layer is drawn over the one below it.
   *
   * 'under' lies on the floor for other things to stand on: a rug does not take up
   * a room the way a table does, so it neither moves aside for one nor pushes one
   * out of the way. 'over' stands on the furniture rather than on the floor: a
   * lamp and the table it sits on want the very same spot, and queueing them up
   * puts the lamp on the floor beside its table. Everything else stands on the
   * floor, which is what leaving this out means.
   */
  layer?: Layer
  /**
   * Stands shoulder to shoulder with its neighbours instead of spreading out along
   * the wall.
   *
   * A kitchen is a run: units, sink, cooker and fridge butt up against one another
   * and the gaps go at the ends. Everything else is happier spread out — two sofas
   * pushed together is not a living room — so this is the exception, said out loud.
   */
  abuts?: boolean
  /**
   * How far past its own size the thing spreads, in millimetres on every side.
   *
   * A table's size is its top, but the chairs tucked round it need floor as well,
   * and a plan that ignores them puts the table against a wall nobody can sit at.
   * Everything else is the size it says it is.
   */
  reach?: number
  /**
   * The plan symbol to draw it with, as a file under the editor's `symbols/`
   * folder.
   *
   * The drawing is taken as the thing seen from straight above, its top edge at
   * the back — the side that goes against a wall — and is scaled to `size`, so a
   * symbol is held to the size its type declares by construction.
   */
  symbol: string
  /** Which rooms it belongs in, by kind. `any` means anywhere. Advice for whoever furnishes. */
  rooms?: readonly string[]
}

/** Under the floor's furniture, on it, or on top of it. */
export type Layer = 'under' | 'floor' | 'over'

export const OBJECT_TYPES: readonly ObjectType[] = CATALOG_OBJECT_TYPES

export const OBJECT_TYPE_IDS = OBJECT_TYPES.map((entry) => entry.id)

export const objectType = (id: string): ObjectType | undefined =>
  OBJECT_TYPES.find((entry) => entry.id === id)

/** Which layer a thing takes up, with the floor as what most things mean. */
export const layerOf = (id: string): Layer => objectType(id)?.layer ?? 'floor'

/** The symbol a type is drawn with, or nothing for a type the catalogue does not know. */
export const symbolOf = (id: string): string | undefined => objectType(id)?.symbol
