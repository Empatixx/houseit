import type { HouseDocument } from '@houseit/core/document'
import { floorMaterial } from '@houseit/core/floor-materials'
import { SLAB } from '@houseit/core/levels'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { holesIn, stairwaysOn, wellsInRoom } from '@houseit/geometry/wells'
import { type Corner, type Finish, type Piece, prism, sheet } from './pieces'

const BARE = '#f7f7f5'
const PLASTER = '#f4f3f0'

const corners = (outline: Point[]): Corner[] => outline.map(({ x, y }) => ({ x, z: -y }))

function laidIn(floor: string | undefined): Finish {
  const material = floor ? floorMaterial(floor) : undefined
  if (!material) return { colour: BARE }
  return {
    colour: '#ffffff',
    texture: material.texture,
    repeat: { x: 1000 / material.unit.width, y: 1000 / material.unit.depth },
  }
}

export function floorPieces(doc: HouseDocument, level: string): Piece[] {
  return roomsOf(doc, level).map((room) => {
    const pierced = wellsInRoom(doc, level, room)
    const laid = sheet({
      outline: corners(room.nodes.map((id) => doc.nodes[id]!)),
      holes: pierced.map((well) => corners(well.outline)),
      paint: laidIn(room.floor),
    })
    const named = { ...laid, name: `floor-${room.nodes.join('-')}` }
    return room.id ? { ...named, of: { kind: 'room' as const, id: room.id } } : named
  })
}

export function ceilingPieces(doc: HouseDocument, level: string): Piece[] {
  const top = doc.levels[level]?.height ?? 0
  const wells = stairwaysOn(doc, level)

  return roomsOf(doc, level).map((room) => {
    const outline = room.nodes.map((id) => doc.nodes[id]!)
    const holes = holesIn(
      outline,
      wells.map((well) => well.outline),
    )
    const lid = prism({
      base: top - SLAB,
      thickness: SLAB,
      outline: corners(outline),
      holes: holes.map((hole) => corners(hole.outline)),
      paint: { colour: PLASTER },
    })
    const named = { ...lid, name: `lid-${room.nodes.join('-')}` }
    return room.id ? { ...named, of: { kind: 'room' as const, id: room.id } } : named
  })
}
