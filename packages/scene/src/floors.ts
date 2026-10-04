import type { HouseDocument } from '@houseit/core/document'
import { floorMaterial } from '@houseit/core/floor-materials'
import { SLAB, soffitOf } from '@houseit/core/levels'
import { roomKindOf } from '@houseit/core/room-kinds'
import { siteHeight } from '@houseit/core/site'
import { offsetOutline } from '@houseit/geometry/clear'
import { shaftOutside, shaftsOn } from '@houseit/geometry/connections'
import { exteriorSides } from '@houseit/geometry/exterior'
import { openingRecesses } from '@houseit/geometry/opening-recesses'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import { ceilingWells, holesIn, wellsInRoom } from '@houseit/geometry/wells'
import { paintFor } from './dressing'
import { type Corner, drum, type Finish, type Piece, prism, sheet } from './pieces'
import { exposedSlabTop } from './slab-top'

const BARE = '#f7f7f5'
const PLASTER = '#f4f3f0'
const EDGE = { colour: '#f1f0ed' }
const GLASS = { colour: '#a7c8e6', opacity: 0.3 }

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
    if (roomKindOf(room)?.id === 'pond') return pondPieces(doc, room)
    const pierced = wellsInRoom(doc, level, room)
    const laid = sheet({
      doubleSided: false,
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
          ...sheet({
            outline: corners(r.extension),
            paint: laidIn(room.floor),
            doubleSided: false,
          }),
          name: `floor-recess-${r.opening}`,
          casts: false,
        })),
    ]
    return pieces.map((piece) =>
      room.id ? { ...piece, of: { kind: 'room' as const, id: room.id } } : piece,
    )
  })
}

const POND = { surface: 120, depth: 900, liner: 30, spacing: 290 }
const WATER: Finish = { colour: '#3f6d72', opacity: 0.72, roughness: 0.05 }
const MUD: Finish = { colour: '#4a4536', roughness: 1 }
const LINER: Finish = { colour: '#5d5a52', roughness: 0.95 }
const STONES = ['#8a867c', '#9b978d', '#77736a', '#a8a397']

function pondPieces(doc: HouseDocument, room: Room): Piece[] {
  const outline = room.nodes.map((id) => doc.nodes[id]!)
  const key = room.nodes.join('-')
  const owner = room.id ? { of: { kind: 'room' as const, id: room.id } } : {}
  const surface = (name: string, base: number, paint: Finish, doubleSided: boolean) => ({
    ...sheet({ base, outline: corners(outline), paint, doubleSided }),
    name: `${name}-${key}`,
    casts: false,
    ...owner,
  })
  const pieces: Piece[] = [
    surface('pond-water', -POND.surface, WATER, true),
    surface('pond-bed', -POND.depth, MUD, false),
  ]
  let stone = 0
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length]!
    const dx = b.x - a.x,
      dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length < 1) return
    let normal = { x: -dy / length, y: dx / length }
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if (!containsPoint(outline, mid.x + normal.x * 50, mid.y + normal.y * 50))
      normal = { x: -normal.x, y: -normal.y }
    pieces.push({
      body: { kind: 'box', width: length, height: POND.depth, depth: POND.liner },
      at: {
        x: mid.x + (normal.x * POND.liner) / 2,
        y: -POND.depth / 2,
        z: -(mid.y + (normal.y * POND.liner) / 2),
      },
      turn: Math.atan2(dy, dx),
      paint: LINER,
      name: `pond-liner-${key}-${i}`,
      casts: false,
      ...owner,
    })
    const count = Math.max(1, Math.round(length / POND.spacing))
    for (let k = 0; k < count; k += 1) {
      const t = k / count
      const n = stone++
      const wobble = ((n * 7919) % 97) / 97
      const r = 110 + wobble * 60
      const h = 70 + (((n * 104729) % 53) / 53) * 40
      pieces.push({
        ...drum({
          x: a.x + dx * t + normal.x * 20,
          z: -(a.y + dy * t + normal.y * 20),
          base: -40,
          r,
          top: r * 0.82,
          h,
          paint: { colour: STONES[n % STONES.length]!, roughness: 0.9 },
        }),
        name: `pond-stone-${key}-${n}`,
        ...owner,
      })
    }
  })
  return pieces
}

export function ceilingPieces(doc: HouseDocument, level: string): Piece[] {
  const soffit = doc.levels[level] ? soffitOf(doc.levels[level]!) : 0
  const slab = doc.levels[level]?.slabThickness ?? SLAB
  const wells = ceilingWells(doc, level)
  const outside = exteriorSides(doc, level)

  const lids = roomsOf(doc, level).flatMap((room) => {
    const kind = roomKindOf(room)
    if (kind?.outdoor) return []
    const outline = structuralOutline(doc, level, room, outside)
    const holes = holesIn(
      outline,
      wells.map((well) => well.outline),
    )
    const lid = prism({
      base: soffit,
      thickness: slab,
      outline: corners(outline),
      holes: holes.map((hole) => corners(hole.outline)),
      paint: kind?.glazed
        ? GLASS
        : paintFor(room.id === undefined ? undefined : doc.rooms[room.id]?.ceiling, PLASTER),
    })
    const named = { ...lid, sidePaint: EDGE, name: `lid-${room.nodes.join('-')}`, casts: false }
    return room.id ? { ...named, of: { kind: 'room' as const, id: room.id } } : named
  })
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
            sidePaint: EDGE,
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
  const floors = upper
    ? floorPieces(doc, upper.id).flatMap((p) => (p.body.kind === 'sheet' ? [p.body] : []))
    : []
  const trimmed = pieces.flatMap<Piece>((p) => {
    if (!p.name?.endsWith('-buildup') || p.body.kind !== 'prism') return [p]
    const elevation = doc.levels[level]!.elevation + soffit + slab + buildup
    const surfaces = (doc.site?.surfaces ?? [])
      .filter((s) => {
        const heights = s.outline.map((p) => siteHeight(s, p.x, p.y))
        return Math.min(...heights) < elevation && Math.max(...heights) > elevation - buildup
      })
      .map((s) => ({
        outline: corners(s.outline),
        holes: floors.map((f) => f.outline),
      }))
    surfaces.push(
      ...(storey?.roofs ?? [])
        .filter((r) => r.baseOffset < 0)
        .map((r) => ({
          outline: corners(r.outline),
          holes: floors.map((f) => f.outline),
        })),
    )
    const remaining = exposedSlabTop(p.body, surfaces)
    const body = p.body
    return remaining === undefined
      ? [p]
      : remaining.map((outline, i) => ({
          ...p,
          name: `${p.name}-${i}`,
          body: { ...body, outline, holes: [] },
        }))
  })
  if (!upper) return trimmed
  return trimmed.map((p) => {
    if (p.body.kind !== 'prism' || Math.abs(p.at.y + p.body.thickness / 2 - storey!.height) > 0.01)
      return p
    const top = exposedSlabTop(p.body, floors)
    return top === undefined ? p : { ...p, body: { ...p.body, top } }
  })
}

function structuralOutline(
  doc: HouseDocument,
  level: string,
  room: Room,
  outside: Map<string, 1 | -1>,
) {
  const nodes = [...room.nodes]
  for (let i = 0; nodes.length > 2 && i < nodes.length; i++) {
    if (nodes[i] === nodes[(i + 2) % nodes.length]) {
      nodes.splice((i + 1) % nodes.length, 1)
      nodes.splice(i % nodes.length, 1)
      i = -1
    }
  }
  return offsetOutline(doc, level, nodes, (wall) =>
    wall && outside.has(wall.id) ? -wall.thickness / 2 : 0,
  )
}

export function underfloorPieces(doc: HouseDocument, level: string): Piece[] {
  const storey = doc.levels[level]
  if (!storey) return []
  const lower = Object.values(doc.levels).find((s) => s.elevation + s.height === storey.elevation)
  const depth = lower ? lower.height - soffitOf(lower) : (storey.slabThickness ?? SLAB)
  const covered = lower
    ? ceilingPieces(doc, lower.id).flatMap((p) =>
        p.body.kind === 'prism' && p.at.y + p.body.thickness / 2 >= lower.height - 0.01
          ? [p.body]
          : [],
      )
    : []
  const outside = exteriorSides(doc, level)
  return roomsOf(doc, level).flatMap((room) => {
    const outline = corners(structuralOutline(doc, level, room, outside))
    const holes = wellsInRoom(doc, level, room).map((w) => corners(w.outline))
    const patches = exposedSlabTop({ outline, holes }, covered)
    const shapes =
      patches === undefined
        ? [{ outline, holes }]
        : patches.map((outline) => ({ outline, holes: [] }))
    return shapes.map((shape, i) => ({
      ...prism({ base: -depth, thickness: depth, ...shape, paint: { colour: PLASTER } }),
      body: { kind: 'prism' as const, ...shape, thickness: depth, top: [] },
      sidePaint: EDGE,
      name: `underfloor-${room.id ?? room.nodes.join('-')}-${i}`,
      casts: false,
      ...(room.id ? { of: { kind: 'room' as const, id: room.id } } : {}),
    }))
  })
}
