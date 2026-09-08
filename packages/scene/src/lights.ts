import type { HouseDocument } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { placedOn } from './furniture'

export type Light = {
  of: string
  at: { x: number; y: number; z: number }
  colour: string
  power: number
}

const GLOW = '#ffd7a4'

const LAMPS: Record<string, { under: number; power: number }> = {
  'floor-lamp': { under: 150, power: 1 },
  'table-lamp': { under: 110, power: 0.6 },
}

export function lightsOn(doc: HouseDocument, level: string): Light[] {
  return placedOn(doc, level).flatMap((thing) => {
    const lamp = LAMPS[thing.object.type]
    if (!lamp) return []
    const stands = heightOf(thing.object.type)
    const base = thing.rest > 0 ? thing.rest : stands.base
    return [
      {
        of: thing.object.id,
        at: {
          x: thing.spot.at.x,
          y: base + stands.height - lamp.under,
          z: -thing.spot.at.y,
        },
        colour: GLOW,
        power: lamp.power,
      },
    ]
  })
}
