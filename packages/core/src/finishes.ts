import { CATALOG_FINISHES, CATALOG_STYLES } from './catalog'

export type Part = 'walls' | 'ceiling' | 'doors' | 'windows'

export const PARTS: readonly Part[] = ['walls', 'ceiling', 'doors', 'windows']

export type Finish = {
  id: string
  label: string
  category: string
  picture?: string
  colour?: string
}

export const FINISHES: readonly Finish[] = CATALOG_FINISHES

export const FINISH_IDS = FINISHES.map((finish) => finish.id)

const WORN: Record<Part, readonly string[]> = {
  walls: ['paint', 'wood_paneling', 'concrete', 'brick', 'stone', 'tile'],
  ceiling: ['paint', 'wood_paneling', 'concrete'],
  doors: ['paint', 'wood', 'metal'],
  windows: ['paint', 'wood', 'metal'],
}

export const finishesFor = (part: Part): Finish[] =>
  FINISHES.filter((finish) => WORN[part].includes(finish.category))

export const finishOf = (id: string | undefined): Finish | undefined =>
  FINISHES.find((finish) => finish.id === id)

export type Style = {
  id: string
  label: string
  blurb: string
  picture: string
  defaults: { floor: string; bathroomFloor: string } & Record<Part, string>
}

export const STYLES: readonly Style[] = CATALOG_STYLES

export const STYLE_IDS = STYLES.map((style) => style.id)

export const styleOf = (id: string | undefined): Style | undefined =>
  STYLES.find((style) => style.id === id)

export const BATHROOM_KINDS: readonly string[] = ['bathroom', 'half-bath']

const COLOUR = /^#[0-9a-f]{6}$/i

export const isColour = (worn: string): boolean => COLOUR.test(worn)

export function wornAs(worn: string, part: Part): string {
  if (isColour(worn)) return worn.toLowerCase()
  if (finishesFor(part).some((finish) => finish.id === worn)) return worn
  throw new Error(
    `${part}: ${worn} is no finish for ${part} — name one of ${finishesFor(part)
      .map((finish) => finish.id)
      .join(', ')}, or give a colour of your own as #rrggbb`,
  )
}
