import type { HouseDocument } from '@houseit/core/document'
import { floorMaterial } from '@houseit/core/floor-materials'
import { SLAB, soffitOf } from '@houseit/core/levels'
import { offsetOutline } from '@houseit/geometry/clear'
import { shaftOutside, shaftsOn } from '@houseit/geometry/connections'
import { exteriorSides } from '@houseit/geometry/exterior'
import { openingRecesses } from '@houseit/geometry/opening-recesses'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { ceilingWells, holesIn, wellsInRoom } from '@houseit/geometry/wells'
import { paintFor } from './dressing'
import { type Corner, type Finish, type Piece, prism, sheet } from './pieces'
import { exposedSlabTop } from './slab-top'

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
  const recesses = openingRecesses(doc, level)
  return roomsOf(doc, level).flatMap((room) => {
    const pierced = wellsInRoom(doc, level, room)
    const laid = sheet({
      outline: corners(room.nodes.map((id) => doc.nodes[id]!)),
      holes: pierced.map((well) => corners(well.outline)),
      paint: laidIn(room.floor),
    })
    const named = { ...laid, name: `floor-${room.nodes.join('-')}`, casts: false }
    const pieces = [
      named,
      ...recesses
        .filter((r) => r.extension.length && room.walls.includes(r.wall))
        .map((r) => ({
          ...sheet({ outline: corners(r.extension), paint: laidIn(room.floor) }),
          name: `floor-recess-${r.opening}`,
          casts: false,
        })),
    ]
    return pieces.map((piece) =>
      room.id ? { ...piece, of: { kind: 'room' as const, id: room.id } } : piece,
    )
  })
}

export function ceilingPieces(doc: HouseDocument, level: string): Piece[] {
  const soffit = doc.levels[level] ? soffitOf(doc.levels[level]!) : 0
  const slab = doc.levels[level]?.slabThickness ?? SLAB
  const wells = ceilingWells(doc, level)
  const outside = exteriorSides(doc, level)

  const lids = roomsOf(doc, level).map((room) => {
    // Shared slabs meet at wall centres; perimeter slabs reach the outer
    // structural face. Free-ended partitions do not cut the slab outline.
    const nodes = [...room.nodes]
    for (let i = 0; nodes.length > 2 && i < nodes.length; i++) {
      if (nodes[i] === nodes[(i + 2) % nodes.length]) {
        nodes.splice((i + 1) % nodes.length, 1)
        nodes.splice(i % nodes.length, 1)
        i = -1
      }
    }
    const outline = offsetOutline(doc, level, nodes, (wall) =>
      wall && outside.has(wall.id) ? -wall.thickness / 2 : 0,
    )
    const holes = holesIn(
      outline,
      wells.map((well) => well.outline),
    )
    const lid = prism({
      base: soffit,
      thickness: slab,
      outline: corners(outline),
      holes: holes.map((hole) => corners(hole.outline)),
      paint: paintFor(room.id === undefined ? undefined : doc.rooms[room.id]?.ceiling, PLASTER),
    })
    const named = { ...lid, name: `lid-${room.nodes.join('-')}`, casts: false }
    return room.id ? { ...named, of: { kind: 'room' as const, id: room.id } } : named
  })
  // Some surveyed room boundaries turn around the shaft, while others enclose
  // it and rely on its derived hole. Close only the uncovered part at its top.
  const covered = lids.flatMap((lid) =>
    lid.body.kind === 'prism' ? [lid.body.outline.map((p) => ({ x: p.x, y: -p.z }))] : [],
  )
  const caps = shaftsOn(doc, level)
    .filter((s) => s.to === level)
    .flatMap((s) => {
      const outside = shaftOutside(s)
      const x0 = outside[0]!.x,
        x1 = outside[2]!.x,
        y0 = outside[0]!.y,
        y1 = outside[2]!.y
      const xs = [
        ...new Set([
          x0,
          x1,
          ...covered.flatMap((r) => r.map((p) => p.x)).filter((x) => x > x0 && x < x1),
        ]),
      ].sort((a, b) => a - b)
      const ys = [
        ...new Set([
          y0,
          y1,
          ...covered.flatMap((r) => r.map((p) => p.y)).filter((y) => y > y0 && y < y1),
        ]),
      ].sort((a, b) => a - b)
      const caps: Piece[] = []
      for (let i = 1; i < xs.length; i++)
        for (let j = 1; j < ys.length; j++) {
          const x = (xs[i - 1]! + xs[i]!) / 2,
            y = (ys[j - 1]! + ys[j]!) / 2
          if (covered.some((r) => containsPoint(r, x, y))) continue
          caps.push({
            ...prism({
              base: soffit,
              thickness: slab,
              paint: { colour: PLASTER },
              outline: corners([
                { x: xs[i - 1]!, y: ys[j - 1]! },
                { x: xs[i]!, y: ys[j - 1]! },
                { x: xs[i]!, y: ys[j]! },
                { x: xs[i - 1]!, y: ys[j]! },
              ]),
            }),
            name: `lid-shaft-${s.id}-${i}-${j}`,
            casts: false,
          })
        }
      return caps
    })
  const ceiling = [...lids, ...caps]
  const buildup = Math.max(0, (doc.levels[level]?.height ?? 0) - soffit - slab)
  const pieces = [
    ...ceiling,
    ...(buildup
      ? ceiling.map((piece) => ({
          ...piece,
          body: piece.body.kind === 'prism' ? { ...piece.body, thickness: buildup } : piece.body,
          at: { ...piece.at, y: soffit + slab + buildup / 2 },
          paint: { colour: BARE },
          name: `${piece.name}-buildup`,
        }))
      : []),
  ]
  const storey = doc.levels[level]
  const upper =
    storey &&
    Object.values(doc.levels).find((s) => s.elevation === storey.elevation + storey.height)
  if (!upper) return pieces
  const floors = floorPieces(doc, upper.id).flatMap((p) =>
    p.body.kind === 'sheet' ? [p.body] : [],
  )
  return pieces.map((p) => {
    if (p.body.kind !== 'prism' || Math.abs(p.at.y + p.body.thickness / 2 - storey!.height) > 0.01)
      return p
    const top = exposedSlabTop(p.body, floors)
    return top === undefined ? p : { ...p, body: { ...p.body, top } }
  })
}
