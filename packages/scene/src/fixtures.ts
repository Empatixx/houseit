import type { HouseDocument } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import { roomKindOf } from '@houseit/core/room-kinds'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { ceilingWells } from '@houseit/geometry/wells'
import type { Light } from './lights'
import { drum, type Finish, type Piece, slab } from './pieces'

export type Fixture = {
  room: string
  at: { x: number; y: number }
  style: 'pendant' | 'flush'
  lumens: number
}

const PENDANT = new Set([
  'living',
  'living-kitchen',
  'dining',
  'bedroom',
  'kitchen',
  'office',
  'cafe',
  'meeting',
  'waiting',
])
const BRIGHT: Record<string, number> = {
  kitchen: 250,
  'living-kitchen': 220,
  bathroom: 250,
  'half-bath': 200,
  office: 300,
  laundry: 200,
  living: 150,
  dining: 180,
  bedroom: 120,
}
const LUX = 120
const CLEAR = 2100
const DROP = 650
const PLASTER = 2
const GLOW: Finish = { colour: '#fff3dc', glow: 1 }
const WHITE: Finish = { colour: '#f4f3f0' }
const CORD: Finish = { colour: '#2a2a2a' }
const SHADE: Finish = { colour: '#e7e1d6', roughness: 0.9 }
const LIGHT = '#ffe2b8'

export function fixturesOn(doc: HouseDocument, level: string): Fixture[] {
  const wells = ceilingWells(doc, level).map((well) => well.outline)
  return roomsOf(doc, level).flatMap((room) => {
    const kind = roomKindOf(room)
    if (kind?.outdoor || room.id === undefined) return []
    const outline = room.nodes.map((id) => doc.nodes[id]!)
    const area = room.area / 1e6
    const xs = outline.map((p) => p.x),
      ys = outline.map((p) => p.y)
    const box = {
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    }
    const wide = box.x1 - box.x0 >= box.y1 - box.y0
    const [across, along] = area > 80 ? [2, 3] : area > 40 ? [2, 2] : area > 22 ? [1, 2] : [1, 1]
    const columns = wide ? along : across
    const rows = wide ? across : along
    const free = (p: { x: number; y: number }) =>
      containsPoint(outline, p.x, p.y) && !wells.some((well) => containsPoint(well, p.x, p.y))
    let spots: { x: number; y: number }[] = []
    for (let i = 0; i < columns; i += 1)
      for (let j = 0; j < rows; j += 1)
        spots.push({
          x: box.x0 + ((i + 0.5) / columns) * (box.x1 - box.x0),
          y: box.y0 + ((j + 0.5) / rows) * (box.y1 - box.y0),
        })
    spots = spots.filter(free)
    if (spots.length === 0) spots = [room.centre].filter(free)
    if (spots.length === 0) return []
    const lumens = (area * (BRIGHT[kind?.id ?? ''] ?? LUX)) / spots.length
    const style = PENDANT.has(kind?.id ?? '') ? 'pendant' : 'flush'
    return spots.map((at) => ({ room: room.id!, at, style, lumens }))
  })
}

export function fixturePieces(doc: HouseDocument, level: string): Piece[] {
  const storey = doc.levels[level]
  if (!storey) return []
  const ceiling = soffitOf(storey) - PLASTER
  return fixturesOn(doc, level).flatMap((fixture, n) => {
    const x = fixture.at.x,
      z = -fixture.at.y
    const name = (part: string) => `light-${fixture.room}-${n}-${part}`
    const parts =
      fixture.style === 'pendant'
        ? pendant(x, z, ceiling).map((piece, i) => ({
            ...piece,
            name: name(['canopy', 'cord', 'shade', 'diffuser'][i]!),
          }))
        : flush(x, z, ceiling).map((piece, i) => ({
            ...piece,
            name: name(['body', 'diffuser'][i]!),
          }))
    return parts.map((piece) => ({
      ...piece,
      role: 'light-fixture' as const,
      of: { kind: 'room' as const, id: fixture.room },
      casts: false,
    }))
  })
}

export function ceilingLightsOn(doc: HouseDocument, level: string): Light[] {
  const storey = doc.levels[level]
  if (!storey) return []
  const ceiling = soffitOf(storey) - PLASTER
  return fixturesOn(doc, level).map((fixture, n) => ({
    of: `${fixture.room}-${n}`,
    at: {
      x: fixture.at.x,
      y: fixture.style === 'pendant' ? shadeBase(ceiling) + 60 : ceiling - 120,
      z: -fixture.at.y,
    },
    colour: LIGHT,
    power: fixture.lumens / 800,
  }))
}

const shadeBase = (ceiling: number) => Math.max(CLEAR, ceiling - 25 - DROP - 200)

function pendant(x: number, z: number, ceiling: number): Piece[] {
  const base = shadeBase(ceiling)
  return [
    drum({ x, z, base: ceiling - 25, r: 60, h: 25, paint: WHITE }),
    slab({ x, z, base: base + 200, w: 8, d: 8, h: ceiling - 25 - base - 200, paint: CORD }),
    drum({ x, z, base, r: 220, top: 160, h: 200, open: true, paint: SHADE }),
    drum({ x, z, base: base + 40, r: 150, h: 8, paint: GLOW }),
  ]
}

function flush(x: number, z: number, ceiling: number): Piece[] {
  return [
    drum({ x, z, base: ceiling - 70, r: 170, h: 70, paint: WHITE }),
    drum({ x, z, base: ceiling - 76, r: 150, h: 8, paint: GLOW }),
  ]
}
