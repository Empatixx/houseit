export type HouseStyle = {
  id: string
  label: string
  roof: {
    shape: 'gable' | 'hip' | 'shed' | 'flat'
    pitch?: number
    covering?: 'roof-tiles' | 'roof-tiles-anthracite' | 'standing-seam' | 'slate' | 'shingles'
  }
  facade: string
  colour?: string
  plinth?: { material: string; height: number }
  accent?: { material: string; side: 'north' | 'south' | 'east' | 'west' }
}

export const HOUSE_STYLES: readonly HouseStyle[] = [
  {
    id: 'classic',
    label: 'Czech village house: clay tile gable, white render, stone plinth',
    roof: { shape: 'gable', pitch: 40, covering: 'roof-tiles' },
    facade: 'render-white',
    plinth: { material: 'stone', height: 450 },
  },
  {
    id: 'villa',
    label: 'Villa: anthracite hip roof, white render, stone plinth',
    roof: { shape: 'hip', pitch: 30, covering: 'roof-tiles-anthracite' },
    facade: 'render-white',
    plinth: { material: 'stone', height: 400 },
  },
  {
    id: 'modern',
    label: 'Modern cube: flat roof, white render, larch to the south',
    roof: { shape: 'flat' },
    facade: 'render-white',
    accent: { material: 'larch-horizontal', side: 'south' },
  },
  {
    id: 'scandinavian',
    label: 'Scandinavian: standing seam gable over charred wood',
    roof: { shape: 'gable', pitch: 40, covering: 'standing-seam' },
    facade: 'charred-wood',
  },
  {
    id: 'rustic',
    label: 'Rustic: shingle gable over larch, stone plinth',
    roof: { shape: 'gable', pitch: 45, covering: 'shingles' },
    facade: 'larch-horizontal',
    plinth: { material: 'stone', height: 600 },
  },
  {
    id: 'industrial',
    label: 'Industrial: standing seam shed over red brick',
    roof: { shape: 'shed', pitch: 10, covering: 'standing-seam' },
    facade: 'brick-red',
    accent: { material: 'cement-panels', side: 'north' },
  },
]

export const HOUSE_STYLE_IDS = HOUSE_STYLES.map((style) => style.id)

export const houseStyle = (id: string) => HOUSE_STYLES.find((style) => style.id === id)
