import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
export type EngineView =
  | 'plan'
  | 'floor-cut'
  | 'section-x'
  | 'section-y'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
const category = (...names: string[]) => ({
  categories: names.map((name) => new RegExp(`^${name}$`)),
})

export const HIDEABLE = {
  furniture: category('IFCFURNISHINGELEMENT'),
  openings: category('IFCDOOR', 'IFCWINDOW'),
  roofs: category('IFCROOF'),
  ceilings: {
    ...category('IFCSLAB'),
    attributes: { queries: [{ name: /^HouseitKey$/, value: /:lid-/ }] },
  },
  site: category('IFCGEOGRAPHICELEMENT', 'IFCSURFACEFEATURE', 'IFCRAILING'),
}
export type Hideable = keyof typeof HIDEABLE

type EngineSettings = {
  view: EngineView
  snap: boolean
  measure: 'none' | 'length' | 'edge'
  cutHeight: number
  offset: number
  lines: boolean
  hidden: Hideable[]
}
type State = EngineSettings & {
  busy: boolean
  error: string | null
  clear: number
  configure: (settings: Partial<EngineSettings>) => void
  clearMeasurements: () => void
}
export const engineViewStore = createStore<State>()((set) => ({
  view: 'plan',
  snap: true,
  measure: 'none',
  cutHeight: 1.2,
  offset: 0,
  lines: false,
  hidden: [],
  busy: true,
  error: null,
  clear: 0,
  configure: (settings) => set(settings),
  clearMeasurements: () => set((s) => ({ clear: s.clear + 1 })),
}))
export function useEngineView<T>(selector: (state: State) => T) {
  return useStore(engineViewStore, selector)
}
