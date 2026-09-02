import { CATALOG_FLOOR_MATERIALS } from './catalog'

/**
 * What a floor can be made of.
 *
 * Kept as data rather than as something the renderer knows, so the command
 * surface can generate its own option list: `set-floor` builds its enum from
 * here, which means `--help` and the MCP tool description list every material
 * without anyone maintaining a second copy of the list.
 *
 * `unit` is the real size of one repeat of the pattern on the floor. It is what
 * makes a 300 mm tile 300 mm in a cupboard and in a hall, instead of stretching
 * to fit whatever room it lands in.
 */
export type FloorMaterial = {
  id: string
  /** What it is called in help and in the plan. */
  label: string
  /**
   * Size of one repeat of the texture on the floor, in millimetres.
   *
   * Small enough to repeat inside a room. A three metre repeat puts a single tile
   * across a kitchen, and one tile of an even material is a grey rectangle — which
   * reads as a floor nobody has chosen rather than as poured concrete.
   */
  unit: { width: number; depth: number }
  /** File name under the editor's texture folder. */
  texture: string
  /** Drawn while the texture loads, and wherever an image cannot be used. */
  colour: string
}

/** the reference's floor photographs, brought in by `scripts/import-catalog.mjs`. */
export const FLOOR_MATERIALS: readonly FloorMaterial[] = CATALOG_FLOOR_MATERIALS

export const FLOOR_MATERIAL_IDS = FLOOR_MATERIALS.map((material) => material.id)

export const floorMaterial = (id: string): FloorMaterial | undefined =>
  FLOOR_MATERIALS.find((material) => material.id === id)
