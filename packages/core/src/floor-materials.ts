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

export const FLOOR_MATERIALS: readonly FloorMaterial[] = [
  { id: 'oak', label: 'Oak boards', unit: u(1200), texture: 'oak.png', colour: '#e6d3b6' },
  {
    id: 'oak-white',
    label: 'Limed oak',
    unit: u(1200),
    texture: 'oak-white.png',
    colour: '#eee9e0',
  },
  { id: 'oak-grey', label: 'Grey oak', unit: u(1200), texture: 'oak-grey.png', colour: '#cdc9c2' },
  {
    id: 'oak-smoked',
    label: 'Smoked oak',
    unit: u(1200),
    texture: 'oak-smoked.png',
    colour: '#b39272',
  },
  { id: 'walnut', label: 'Walnut boards', unit: u(1200), texture: 'walnut.png', colour: '#7d5c42' },
  {
    id: 'parquet',
    label: 'Block parquet',
    unit: u(600),
    texture: 'parquet.png',
    colour: '#d9b681',
  },
  { id: 'tile', label: 'Ceramic tile', unit: u(600), texture: 'tile.png', colour: '#dcdcd8' },
  { id: 'marble', label: 'Marble', unit: u(1400), texture: 'marble.png', colour: '#e8e7e4' },
  { id: 'terrazzo', label: 'Terrazzo', unit: u(1200), texture: 'terrazzo.png', colour: '#e0ddd5' },
  {
    id: 'concrete',
    label: 'Poured concrete',
    unit: u(1500),
    texture: 'concrete.png',
    colour: '#cbcac6',
  },
  { id: 'carpet', label: 'Carpet', unit: u(1000), texture: 'carpet.png', colour: '#b9ada0' },
] as const

/** Every texture is square, so a repeat is stated once. */
function u(side: number) {
  return { width: side, depth: side }
}

export const FLOOR_MATERIAL_IDS = FLOOR_MATERIALS.map((material) => material.id)

export const floorMaterial = (id: string): FloorMaterial | undefined =>
  FLOOR_MATERIALS.find((material) => material.id === id)
