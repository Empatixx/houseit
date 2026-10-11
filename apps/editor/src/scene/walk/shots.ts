import type { HouseDocument } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { levelsOf } from '@houseit/core/levels'
import { isOutdoor } from '@houseit/geometry/enclosure'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { swingOf } from '@houseit/geometry/swing'

export type Shot = {
  level: string
  room: string
  name: string
  at: Point
  yaw: number
  pitch: number
  eye: number
}

const EYE = 1350
export const DOLLY = 300
const GRID = 300
const OFF_WALL = 250
const OFF_THINGS = 300
const OFF_LEAF = 350
const NEAR = 1100
const LOOMING = 1
const CRAMPED = 0.3
const TALL = 1200
const LOW = 400
const CENTRED = 0.3
const EDGE = 7
const COVERAGE = 6
const FURNISHED = 0.5
const DEPTH = 0.25
const SMALL = 6e6
const OUTSIDE = 450
const LEAF_NEAR = 1800
const BLANK = 1800
const FAR = 8000
const ESCAPED = 0
const FRAMED = 0.9
const TURNS = 36
const RAYS = 9
const SECOND_ROOM = 14e6
const SUBJECT = 0.5
const SECOND_APART = 2500
const SECOND_TURN = (70 * Math.PI) / 180

type Wall = { a: Point; b: Point; half: number }

type Thing = { samples: Point[]; centre: Point; weight: number; height: number; leaf?: boolean }

type Scene = {
  outline: Point[]
  walls: Wall[]
  screens: Wall[]
  things: Thing[]
  swings: Box[]
  near: number
  blank: number
}

type Box = { x0: number; y0: number; x1: number; y1: number }

type Scored = { at: Point; yaw: number; score: number; pitch: number }

export function tourOf(doc: HouseDocument, fov = 90, first?: string): Shot[] {
  const storeys = levelsOf(doc).map((storey) => storey.id)
  const ordered =
    first && storeys.includes(first) ? [first, ...storeys.filter((id) => id !== first)] : storeys
  return ordered.flatMap((level) =>
    walkingOrder(doc, level).flatMap((room) => shotsOf(doc, level, room, fov)),
  )
}

export function shotsOf(doc: HouseDocument, level: string, room: Room, fov = 90): Shot[] {
  if (!room.id) return []
  const scene = sceneOf(doc, level, room)
  const half = (fov * Math.PI) / 360
  const scored = candidatesOf(doc, level, scene, room).flatMap((candidate) =>
    Array.from({ length: TURNS }, (_, turn) => {
      const yaw = (turn / TURNS) * 2 * Math.PI - Math.PI
      return scoreOf(scene, candidate, yaw, half)
    }),
  )
  if (scored.length === 0) return []
  const best = scored.reduce((top, next) => (next.score > top.score ? next : top))
  const chosen = [best]
  const subjects = scene.things.filter((thing) => thing.weight >= SUBJECT && thing.height > 50)
  if (room.area > SECOND_ROOM && subjects.length >= 2) {
    const other = scored
      .filter(
        (shot) =>
          Math.hypot(shot.at.x - best.at.x, shot.at.y - best.at.y) >= SECOND_APART &&
          Math.abs(turnBetween(shot.yaw, best.yaw)) >= SECOND_TURN,
      )
      .reduce<Scored | undefined>(
        (top, next) => (!top || next.score > top.score ? next : top),
        undefined,
      )
    if (other && other.score >= best.score * 0.55) chosen.push(other)
  }
  return chosen.map((shot) => ({
    level,
    room: room.id!,
    name: room.name ?? room.id!,
    at: shot.at,
    yaw: shot.yaw,
    pitch: shot.pitch,
    eye: EYE,
  }))
}

function sceneOf(doc: HouseDocument, level: string, room: Room): Scene {
  const outline = outlineOf(doc, room)
  const walls = room.walls.flatMap((id) => {
    const wall = doc.walls[id]
    const a = wall && doc.nodes[wall.a]
    const b = wall && doc.nodes[wall.b]
    if (!wall || !a || !b) return []
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const gaps = Object.values(doc.openings)
      .filter((opening) => opening.wall === id && opening.kind !== 'window')
      .map(
        (opening) =>
          [opening.t * length - opening.width / 2, opening.t * length + opening.width / 2] as const,
      )
      .sort((one, other) => one[0] - other[0])
    const at = (d: number) => ({
      x: a.x + ((b.x - a.x) * d) / length,
      y: a.y + ((b.y - a.y) * d) / length,
    })
    const solid: Wall[] = []
    let from = 0
    for (const [start, end] of gaps) {
      if (start > from) solid.push({ a: at(from), b: at(start), half: wall.thickness / 2 })
      from = Math.max(from, end)
    }
    if (from < length) solid.push({ a: at(from), b: b, half: wall.thickness / 2 })
    return solid
  })
  const span = boxOf(outline)
  const near = Math.min(NEAR, CRAMPED * Math.min(span.x1 - span.x0, span.y1 - span.y0))
  const blank = Math.min(BLANK, 0.5 * Math.max(span.x1 - span.x0, span.y1 - span.y0))

  const objects = Object.values(doc.objects).flatMap((object): Thing[] => {
    if (object.level !== level || object.room !== room.id) return []
    const spot = standingAt(doc, level, room, object)
    if (!spot) return []
    const pieces = piecesOf(spot, object)
    const corners = pieces.flat()
    if (corners.length === 0) return []
    const { height, base } = heightOf(object.type)
    const top = base + height
    const area = (object.width * object.depth) / 1e6
    const weight = Math.sqrt(area) * (Math.min(top, 1800) / 1000 + 0.3) * (height < 50 ? 0.3 : 1)
    return [
      { samples: [...corners, centreOf(corners)], centre: centreOf(corners), weight, height: top },
    ]
  })

  const openings = Object.values(doc.openings).filter((opening) =>
    room.walls.includes(opening.wall),
  )
  const windows = openings.flatMap((opening): Thing[] => {
    if (opening.kind === 'door') return []
    const wall = doc.walls[opening.wall]
    const a = wall && doc.nodes[wall.a]
    const b = wall && doc.nodes[wall.b]
    if (!a || !b) return []
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const unit = { x: (b.x - a.x) / length, y: (b.y - a.y) / length }
    const centre = { x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t }
    const reach = opening.width / 2
    const ends = [-reach, reach].map((d) => ({
      x: centre.x + unit.x * d,
      y: centre.y + unit.y * d,
    }))
    return [
      {
        samples: [...ends, centre],
        centre,
        weight: (opening.width / 1000) * 0.8,
        height: opening.sillHeight + opening.height,
      },
    ]
  })

  const leaves = openings.flatMap((opening): Thing[] => {
    if (opening.kind !== 'door' || opening.variant !== 'hinged') return []
    const wall = doc.walls[opening.wall]
    const a = wall && doc.nodes[wall.a]
    const b = wall && doc.nodes[wall.b]
    if (!a || !b) return []
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const unit = { x: (b.x - a.x) / length, y: (b.y - a.y) / length }
    const into = { x: -unit.y * opening.swing, y: unit.x * opening.swing }
    const along = opening.t * length + ((opening.hinge === 'a' ? -1 : 1) * opening.width) / 2
    const hinge = { x: a.x + unit.x * along, y: a.y + unit.y * along }
    const reach = opening.leafWidth ?? opening.width
    const samples = [0.15, 0.5, 0.9].map((f) => ({
      x: hinge.x + into.x * reach * f,
      y: hinge.y + into.y * reach * f,
    }))
    return [{ samples, centre: samples[1]!, weight: 0, height: opening.height, leaf: true }]
  })

  const swings = openings.flatMap((opening) => {
    const swing = swingOf(doc, opening)
    return swing ? [swing] : []
  })

  const screens = leaves.map((leaf) => ({ a: leaf.samples[0]!, b: leaf.samples.at(-1)!, half: 20 }))

  return {
    outline,
    walls,
    screens,
    things: [...objects, ...windows, ...leaves],
    swings,
    near,
    blank,
  }
}

function candidatesOf(doc: HouseDocument, level: string, scene: Scene, room: Room): Point[] {
  const box = boxOf(scene.outline)
  const grid = (offWall: number, offThings: number) => {
    const found: Point[] = []
    for (let x = box.x0 + GRID / 2; x < box.x1; x += GRID) {
      for (let y = box.y0 + GRID / 2; y < box.y1; y += GRID) {
        const at = { x, y }
        if (!containsPoint(scene.outline, x, y)) continue
        if (scene.walls.some((wall) => distanceToSegment(at, wall.a, wall.b) - wall.half < offWall))
          continue
        if (scene.swings.some((swing) => insideBox(swing, at, 100))) continue
        if (crowded(scene, at, offThings)) continue
        found.push(at)
      }
    }
    return found
  }
  const inside = grid(OFF_WALL, OFF_THINGS)
  const indoors = roomsOf(doc, level).filter((other) => other.id !== room.id && !isOutdoor(other))
  const doorways = doorwaysOf(doc, scene, room).filter(
    (at) =>
      !crowded(scene, at, OFF_THINGS) &&
      (containsPoint(scene.outline, at.x, at.y) ||
        indoors.some((other) => containsPoint(outlineOf(doc, other), at.x, at.y))),
  )
  return [...(inside.length > 0 ? inside : grid(OFF_WALL / 2, OFF_THINGS / 2)), ...doorways]
}

function crowded(scene: Scene, at: Point, offThings: number): boolean {
  return scene.things.some((thing) =>
    thing.leaf
      ? thing.samples.some((sample) => distance(sample, at) < OFF_LEAF)
      : thing.weight > 0 && thing.height > 50 && insideBox(boxOf(thing.samples), at, offThings),
  )
}

const outlineOf = (doc: HouseDocument, room: Room) =>
  room.nodes.map((node) => doc.nodes[node]).filter((node) => node !== undefined)

function doorwaysOf(doc: HouseDocument, scene: Scene, room: Room): Point[] {
  return Object.values(doc.openings).flatMap((opening) => {
    if (opening.kind === 'window' || !room.walls.includes(opening.wall)) return []
    const wall = doc.walls[opening.wall]
    const a = wall && doc.nodes[wall.a]
    const b = wall && doc.nodes[wall.b]
    if (!wall || !a || !b) return []
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
    const on = { x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t }
    return [1, -1].flatMap((side) => {
      const inside = wall.thickness / 2 + 150
      const at = { x: on.x + normal.x * side * inside, y: on.y + normal.y * side * inside }
      if (!containsPoint(scene.outline, at.x, at.y)) return []
      if (room.area >= SMALL) return [at]
      const outside = wall.thickness / 2 + OUTSIDE
      const back = { x: on.x - normal.x * side * outside, y: on.y - normal.y * side * outside }
      return [at, back]
    })
  })
}

function scoreOf(scene: Scene, at: Point, yaw: number, half: number): Scored {
  let score = 0
  let reach = 0
  let weighed = 0
  const framed = half * FRAMED
  const ahead = { x: at.x + Math.sin(yaw) * DOLLY, y: at.y + Math.cos(yaw) * DOLLY }
  const furnished = scene.things.reduce((sum, thing) => sum + thing.weight, 0)
  const scale = COVERAGE / Math.max(furnished, FURNISHED)
  const inView = (point: Point, within: number) =>
    Math.abs(turnBetween(bearing(at, point), yaw)) < within && inSight(scene, at, point)
  for (const thing of scene.things) {
    const away = distance(at, thing.centre)
    if (thing.leaf) {
      const seen = thing.samples.filter((sample) => inView(sample, half))
      if (away >= LEAF_NEAR || seen.length === 0) continue
      const middle = Math.min(
        ...seen.map((sample) => Math.abs(turnBetween(bearing(at, sample), yaw))),
      )
      score -= (0.5 + 2.5 * (1 - away / LEAF_NEAR)) * (1 - middle / half)
      continue
    }
    const box = boxOf(thing.samples)
    const near = Math.max(scene.near, thing.height > TALL ? LOOMING * thing.height : 0)
    const looms =
      thing.height > LOW &&
      edgesOf(box).some((point) => distance(point, ahead) < near && inView(point, half))
    if (looms) {
      score -= thing.weight * scale * 2 + 2
      continue
    }
    const seen = thing.samples.filter((sample) => inView(sample, framed))
    if (seen.length === 0) continue
    const share = seen.length / thing.samples.length
    const aside = Math.abs(turnBetween(bearing(at, thing.centre), yaw)) / framed
    const gain =
      thing.weight *
      scale *
      share *
      share *
      (away > 6000 ? 0.7 : 1) *
      (1 - CENTRED * Math.min(1, aside))
    score += gain
    reach += away * gain
    weighed += gain
  }

  let depth = 0
  let middle = FAR
  for (let ray = 0; ray < RAYS; ray += 1) {
    const turn = yaw - framed + (2 * framed * ray) / (RAYS - 1)
    const cast = castTo(scene, at, turn)
    const hit = cast >= FAR ? ESCAPED : cast
    depth += hit
    if (ray === (RAYS - 1) / 2) middle = hit
  }
  score += DEPTH * (depth / RAYS / 1000)
  if (middle < scene.blank) score -= 2 * (1 - middle / scene.blank) + 1

  const focus = weighed > 0 ? reach / weighed : 3000
  const pitch = -Math.max(0.05, Math.min(0.25, Math.atan((EYE - 600) / focus)))
  return { at, yaw, score, pitch }
}

function inSight(scene: Scene, from: Point, to: Point): boolean {
  return [...scene.walls, ...scene.screens].every((wall) => {
    const t = crossing(from, to, wall.a, wall.b)
    return t === undefined || t > 0.97
  })
}

function castTo(scene: Scene, from: Point, yaw: number): number {
  const to = { x: from.x + Math.sin(yaw) * FAR, y: from.y + Math.cos(yaw) * FAR }
  return scene.walls.reduce((nearest, wall) => {
    const t = crossing(from, to, wall.a, wall.b)
    return t === undefined ? nearest : Math.min(nearest, t * FAR - wall.half)
  }, FAR)
}

function crossing(p: Point, q: Point, a: Point, b: Point): number | undefined {
  const r = { x: q.x - p.x, y: q.y - p.y }
  const s = { x: b.x - a.x, y: b.y - a.y }
  const denominator = r.x * s.y - r.y * s.x
  if (Math.abs(denominator) < 1e-9) return undefined
  const t = ((a.x - p.x) * s.y - (a.y - p.y) * s.x) / denominator
  const u = ((a.x - p.x) * r.y - (a.y - p.y) * r.x) / denominator
  return t > 1e-6 && t <= 1 && u >= 0 && u <= 1 ? t : undefined
}

function walkingOrder(doc: HouseDocument, level: string): Room[] {
  const all = roomsOf(doc, level).filter((room) => room.id && !isOutdoor(room))
  if (all.length === 0) return []
  const shared = new Map<string, number>()
  for (const room of all)
    for (const wall of room.walls) shared.set(wall, (shared.get(wall) ?? 0) + 1)
  const entrance = all.find((room) =>
    Object.values(doc.openings).some(
      (opening) =>
        opening.kind !== 'window' &&
        room.walls.includes(opening.wall) &&
        shared.get(opening.wall) === 1,
    ),
  )
  const left = [...all]
  const order: Room[] = []
  let here = entrance ?? all.reduce((best, next) => (next.area > best.area ? next : best))
  while (left.length > 0) {
    left.splice(left.indexOf(here), 1)
    order.push(here)
    const from = here.centre
    const next = left.reduce<Room | undefined>(
      (nearest, room) =>
        !nearest || distance(room.centre, from) < distance(nearest.centre, from) ? room : nearest,
      undefined,
    )
    if (!next) break
    here = next
  }
  return order
}

export const turnBetween = (a: number, b: number) => {
  const d = (((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)
  return d - Math.PI
}

const bearing = (from: Point, to: Point) => Math.atan2(to.x - from.x, to.y - from.y)

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const centreOf = (points: Point[]): Point => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
})

const boxOf = (points: Point[]): Box => ({
  x0: Math.min(...points.map((point) => point.x)),
  y0: Math.min(...points.map((point) => point.y)),
  x1: Math.max(...points.map((point) => point.x)),
  y1: Math.max(...points.map((point) => point.y)),
})

const insideBox = (box: Box, at: Point, margin: number) =>
  at.x > box.x0 - margin &&
  at.x < box.x1 + margin &&
  at.y > box.y0 - margin &&
  at.y < box.y1 + margin

const edgesOf = (box: Box): Point[] =>
  Array.from({ length: EDGE }, (_, step) => step / (EDGE - 1)).flatMap((f) => [
    { x: box.x0 + (box.x1 - box.x0) * f, y: box.y0 },
    { x: box.x0 + (box.x1 - box.x0) * f, y: box.y1 },
    { x: box.x0, y: box.y0 + (box.y1 - box.y0) * f },
    { x: box.x1, y: box.y0 + (box.y1 - box.y0) * f },
  ])

function distanceToSegment(at: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / length))
  return Math.hypot(at.x - a.x - dx * t, at.y - a.y - dy * t)
}
