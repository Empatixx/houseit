/**
 * What a thing's shape is filled with.
 *
 * Kept apart from the shape on purpose. A table is one skeleton — a top and the
 * chairs round it — and oak, walnut, marble or glass are four ways of filling it,
 * not four tables. Separating them means a new material costs a row here and a
 * new piece of furniture costs a skeleton, and neither costs the other anything.
 */
export type Surface = {
  id: string
  label: string
  /** Flat colour, and what a textured surface falls back to before its image loads. */
  fill: string
  /** The line the shape is drawn with. Always darker than the fill. */
  line: string
  /** Image under the editor's texture folder, for surfaces that have one. */
  texture?: string
  /**
   * Size of one repeat of that image on the object, in millimetres.
   *
   * Furniture scale, not floor scale. A 2.4 m repeat is right for boards running
   * across a room and wrong for a 1.2 m vanity top, which then gets half a tile
   * of it — and half a tile of marble is a plain grey rectangle.
   */
  unit?: number
  /**
   * Whether the image is a pattern to be coloured by `fill` rather than a picture
   * of the material itself. One weave then serves grey, blue and green upholstery
   * instead of three near-identical files — and a new colour costs a row here.
   */
  tint?: boolean
}

export const SURFACES: readonly Surface[] = [
  {
    id: 'oak',
    label: 'Oak',
    fill: '#e2c9a2',
    line: '#8a6a44',
    texture: 'wood-oak.png',
    unit: 1200,
  },
  {
    id: 'walnut',
    label: 'Walnut',
    fill: '#9c7454',
    line: '#4f3826',
    texture: 'wood-walnut.png',
    unit: 1200,
  },
  {
    id: 'marble',
    label: 'Marble',
    fill: '#eeedeb',
    line: '#8f8f8b',
    texture: 'stone-marble.png',
    unit: 1000,
  },
  { id: 'glass', label: 'Glass', fill: '#dfeaef', line: '#7f99a4', ...pattern('glass.png', 1400) },
  { id: 'white', label: 'White', fill: '#f7f7f5', line: '#9d9d99' },
  { id: 'black', label: 'Black', fill: '#3c3c3f', line: '#1c1c1e' },
  { id: 'grey', label: 'Grey', fill: '#c4c4c0', line: '#82827e', ...pattern('weave.png', 320) },
  {
    id: 'steel',
    label: 'Stainless steel',
    fill: '#ced3d7',
    line: '#858c92',
    ...pattern('brushed.png', 700),
  },
  {
    id: 'graphite',
    label: 'Graphite',
    fill: '#83888c',
    line: '#4a4e52',
    ...pattern('brushed.png', 700),
  },
  { id: 'fabric', label: 'Fabric', fill: '#c6bfb2', line: '#837b6c', ...pattern('weave.png', 320) },
  { id: 'blue', label: 'Blue', fill: '#9dacc0', line: '#5d6b80', ...pattern('weave.png', 320) },
  { id: 'green', label: 'Green', fill: '#8ba57d', line: '#546b49', ...pattern('weave.png', 320) },
  { id: 'linen', label: 'Linen', fill: '#ded5c4', line: '#a2977f', ...pattern('weave.png', 380) },
  { id: 'rust', label: 'Rust', fill: '#b5806a', line: '#7a4f3d', ...pattern('weave.png', 320) },
  {
    id: 'dots',
    label: 'Dotted rug',
    fill: '#8fa8c4',
    line: '#5b7392',
    texture: 'rug-dots.png',
    unit: 1600,
  },
  {
    id: 'stripes',
    label: 'Striped rug',
    fill: '#cbb8a0',
    line: '#8d7a62',
    texture: 'rug-stripes.png',
    unit: 1200,
  },
  {
    id: 'check',
    label: 'Checked rug',
    fill: '#96a88e',
    line: '#5f6f58',
    texture: 'rug-check.png',
    unit: 1600,
  },
] as const

/** A pattern the surface's own colour is laid over, rather than a picture of it. */
function pattern(texture: string, unit: number) {
  return { texture, unit, tint: true } as const
}

export const SURFACE_IDS = SURFACES.map((surface) => surface.id)

export const surfaceOf = (id: string): Surface | undefined =>
  SURFACES.find((surface) => surface.id === id)
