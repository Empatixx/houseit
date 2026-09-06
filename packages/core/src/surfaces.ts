export type Surface = {
  id: string
  label: string
  fill: string
  line: string
}

export const SURFACES: readonly Surface[] = [
  { id: 'oak', label: 'Oak', fill: '#e2c9a2', line: '#8a6a44' },
  { id: 'walnut', label: 'Walnut', fill: '#9c7454', line: '#4f3826' },
  { id: 'marble', label: 'Marble', fill: '#eeedeb', line: '#8f8f8b' },
  { id: 'glass', label: 'Glass', fill: '#dfeaef', line: '#7f99a4' },
  { id: 'white', label: 'White', fill: '#f7f7f5', line: '#9d9d99' },
  { id: 'black', label: 'Black', fill: '#3c3c3f', line: '#1c1c1e' },
  { id: 'grey', label: 'Grey', fill: '#c4c4c0', line: '#82827e' },
  { id: 'steel', label: 'Stainless steel', fill: '#ced3d7', line: '#858c92' },
  { id: 'graphite', label: 'Graphite', fill: '#83888c', line: '#4a4e52' },
  { id: 'fabric', label: 'Fabric', fill: '#c6bfb2', line: '#837b6c' },
  { id: 'blue', label: 'Blue', fill: '#9dacc0', line: '#5d6b80' },
  { id: 'green', label: 'Green', fill: '#8ba57d', line: '#546b49' },
  { id: 'linen', label: 'Linen', fill: '#ded5c4', line: '#a2977f' },
  { id: 'rust', label: 'Rust', fill: '#b5806a', line: '#7a4f3d' },
  { id: 'dots', label: 'Dotted rug', fill: '#8fa8c4', line: '#5b7392' },
  { id: 'stripes', label: 'Striped rug', fill: '#cbb8a0', line: '#8d7a62' },
  { id: 'check', label: 'Checked rug', fill: '#96a88e', line: '#5f6f58' },
] as const

export const SURFACE_IDS = SURFACES.map((surface) => surface.id)

export const surfaceOf = (id: string): Surface | undefined =>
  SURFACES.find((surface) => surface.id === id)
