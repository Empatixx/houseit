export type FacadeMaterial = {
  id: string
  label: string
  colour: string
  texture: string
  unit: { width: number; height: number }
}

export const FACADE_MATERIALS: readonly FacadeMaterial[] = [
  {
    id: 'render-white',
    label: 'White render',
    colour: '#f1efea',
    texture: 'facade/render.svg',
    unit: { width: 1000, height: 1000 },
  },
  {
    id: 'render-grey',
    label: 'Grey render',
    colour: '#b9b8b3',
    texture: 'facade/render.svg',
    unit: { width: 1000, height: 1000 },
  },
  {
    id: 'larch-horizontal',
    label: 'Larch cladding, horizontal',
    colour: '#a37a52',
    texture: 'facade/larch-horizontal.svg',
    unit: { width: 1000, height: 1000 },
  },
  {
    id: 'larch-vertical',
    label: 'Larch cladding, vertical',
    colour: '#a37a52',
    texture: 'facade/larch-vertical.svg',
    unit: { width: 1000, height: 1000 },
  },
  {
    id: 'charred-wood',
    label: 'Charred wood cladding',
    colour: '#34302d',
    texture: 'facade/charred-wood.svg',
    unit: { width: 1000, height: 1000 },
  },
  {
    id: 'brick-red',
    label: 'Red facing brick',
    colour: '#8f4632',
    texture: 'facade/brick-red.svg',
    unit: { width: 900, height: 750 },
  },
  {
    id: 'brick-white',
    label: 'White facing brick',
    colour: '#ddd7cb',
    texture: 'facade/brick-white.svg',
    unit: { width: 900, height: 750 },
  },
  {
    id: 'stone',
    label: 'Stone',
    colour: '#a39a8b',
    texture: 'facade/stone.svg',
    unit: { width: 1200, height: 1000 },
  },
  {
    id: 'cement-panels',
    label: 'Cement board panels',
    colour: '#a9aba8',
    texture: 'facade/cement-panels.svg',
    unit: { width: 2400, height: 1200 },
  },
  {
    id: 'concrete',
    label: 'Exposed concrete',
    colour: '#bdbcb7',
    texture: 'facade/concrete.svg',
    unit: { width: 2400, height: 1200 },
  },
]

export const FACADE_MATERIAL_IDS = FACADE_MATERIALS.map((material) => material.id)

export const facadeMaterial = (id: string | undefined) =>
  FACADE_MATERIALS.find((material) => material.id === id)
