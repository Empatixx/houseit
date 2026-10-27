import type { HouseDocument } from '@houseit/core/document'
import {
  FENCE_KINDS,
  FENCES,
  type Fence,
  fenceLength,
  fenceRuns,
  type Gate,
  GateSchema,
} from '@houseit/core/fences'
import { levelsOf } from '@houseit/core/levels'
import { boxOf } from '@houseit/geometry/boxes'
import { planExtent } from '@houseit/geometry/dimensions'
import { exteriorSides } from '@houseit/geometry/exterior'
import { buildingEnvelopeOf, sitePointInHouse } from '@houseit/geometry/site'
import type { Draft } from 'immer'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'

type Doc = HouseDocument | Draft<HouseDocument>
type Point = { x: number; y: number }
type Box = { x0: number; y0: number; x1: number; y1: number }

const Corner = z.object({ x: length(), y: length() })
const colour = z.string().regex(/^#[0-9a-f]{6}$/i)

export function houseBox(doc: Doc): Box | undefined {
  const envelope = buildingEnvelopeOf(doc as HouseDocument).flat()
  if (envelope.length > 0) return boxOf(envelope)
  const ground = levelsOf(doc as HouseDocument)[0]
  return ground ? planExtent(doc as HouseDocument, ground.id) : undefined
}

function parcelRing(doc: Doc): Point[] {
  const site = doc.parcelSite
  if (!site)
    throw new CommandError(
      'add-fence: there is no parcel to fence — use --around with a distance, or --points',
    )
  const outer = site.parcel.polygons[0]!.outer
  return outer.map((point) => sitePointInHouse(point, site.housePlacement))
}

function aroundHouse(doc: Doc, margin: number): Point[] {
  const box = houseBox(doc)
  if (!box) throw new CommandError('add-fence: there is no house yet to fence round')
  return [
    { x: Math.round(box.x0 - margin), y: Math.round(box.y0 - margin) },
    { x: Math.round(box.x1 + margin), y: Math.round(box.y0 - margin) },
    { x: Math.round(box.x1 + margin), y: Math.round(box.y1 + margin) },
    { x: Math.round(box.x0 - margin), y: Math.round(box.y1 + margin) },
  ]
}

function frontDoor(doc: Doc): Point | undefined {
  const ground = levelsOf(doc as HouseDocument)[0]
  if (!ground) return undefined
  const outside = exteriorSides(doc as HouseDocument, ground.id)
  for (const opening of Object.values(doc.openings)) {
    if (opening.kind !== 'door' || !outside.has(opening.wall)) continue
    const wall = doc.walls[opening.wall]
    const a = wall && doc.nodes[wall.a]
    const b = wall && doc.nodes[wall.b]
    if (a && b) return { x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t }
  }
  return undefined
}

function nearestAlong(fence: Pick<Fence, 'points' | 'closed'>, point: Point): number {
  let best = { distance: Number.POSITIVE_INFINITY, at: 0 }
  for (const run of fenceRuns(fence)) {
    const dx = run.to.x - run.from.x
    const dy = run.to.y - run.from.y
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - run.from.x) * dx + (point.y - run.from.y) * dy) / (run.length ** 2 || 1),
      ),
    )
    const near = { x: run.from.x + dx * t, y: run.from.y + dy * t }
    const distance = Math.hypot(point.x - near.x, point.y - near.y)
    if (distance < best.distance) best = { distance, at: run.start + t * run.length }
  }
  return Math.round(best.at)
}

function gatesFor(
  fence: Pick<Fence, 'points' | 'closed'>,
  doc: Doc,
  given: Gate[] | undefined,
  width: number,
): Gate[] {
  if (given) return given
  const door = frontDoor(doc)
  if (!door) return []
  const total = fenceLength(fence)
  const at = Math.min(Math.max(nearestAlong(fence, door), width / 2), total - width / 2)
  return [{ at: Math.round(at - width / 2), width, kind: 'gate' }]
}

export const addFence = defineCommand({
  name: 'add-fence',
  summary: `Fence the garden (${FENCE_KINDS.join(', ')}). --around parcel follows the cadastral parcel, --around <distance> runs a rectangle that far off the house, or --points JSON [{x,y},...] an open run (--closed to shut it). --height and --colour default to the kind. A gate opposite the front door comes by itself (--gate-width, default 1200); --gates JSON [{at,width,kind:gate|opening}] places them, at in mm along the fence from its first point, and [] leaves none`,
  args: z.object({
    kind: z.enum(FENCE_KINDS),
    around: z.string().min(1).optional(),
    points: json(z.array(Corner).min(2)).optional(),
    closed: z.coerce.boolean().optional(),
    height: length().optional(),
    colour: colour.optional(),
    gateWidth: length().optional(),
    gates: json(z.array(GateSchema)).optional(),
  }),
  run: (draft, args) => {
    const kind = FENCES[args.kind]
    let points: Point[]
    let closed = args.closed ?? false
    if (args.points) points = args.points
    else if (args.around === 'parcel') {
      points = parcelRing(draft)
      closed = true
    } else if (args.around) {
      const margin = length().parse(args.around)
      points = aroundHouse(draft, margin)
      closed = true
    } else
      throw new CommandError(
        'add-fence: say where — --around parcel, --around <distance> or --points',
      )
    const shape = { points, closed }
    const total = fenceLength(shape)
    const gates = gatesFor(shape, draft, args.gates, args.gateWidth ?? 1200)
    for (const gate of gates)
      if (gate.at < 0 || gate.at + gate.width > total)
        throw new CommandError(
          `add-fence: a gate at ${gate.at} mm, ${gate.width} wide, does not fit the ${Math.round(total)} mm fence`,
        )
    draft.fences ??= {}
    const id = allocateId(draft.fences, 'g')
    draft.fences[id] = {
      id,
      kind: args.kind,
      points,
      closed,
      height: args.height ?? kind.height,
      colour: args.colour ?? kind.colour,
      gates,
    }
    return { changed: [id] }
  },
})

export const updateFence = defineCommand({
  name: 'update-fence',
  summary: `Change a fence by its id: --kind (${FENCE_KINDS.join(', ')}), --height, --colour, --gates JSON [{at,width,kind}]`,
  args: z.object({
    id: z.string().min(1),
    kind: z.enum(FENCE_KINDS).optional(),
    height: length().optional(),
    colour: colour.optional(),
    gates: json(z.array(GateSchema)).optional(),
  }),
  run: (draft, args) => {
    const fence = draft.fences?.[args.id]
    if (!fence) throw new CommandError(`update-fence: there is no fence ${args.id}`)
    if (args.kind !== undefined) {
      if (args.colour === undefined && fence.colour === FENCES[fence.kind].colour)
        fence.colour = FENCES[args.kind].colour
      fence.kind = args.kind
    }
    if (args.height !== undefined) fence.height = args.height
    if (args.colour !== undefined) fence.colour = args.colour
    if (args.gates !== undefined) {
      const total = fenceLength(fence)
      for (const gate of args.gates)
        if (gate.at < 0 || gate.at + gate.width > total)
          throw new CommandError(
            `update-fence: a gate at ${gate.at} mm does not fit the ${Math.round(total)} mm fence`,
          )
      fence.gates = args.gates
    }
    return { changed: [args.id] }
  },
})

export const removeFence = defineCommand({
  name: 'remove-fence',
  summary: 'Take a fence down by its id',
  args: z.object({ id: z.string().min(1) }),
  run: (draft, args) => {
    if (!draft.fences?.[args.id])
      throw new CommandError(`remove-fence: there is no fence ${args.id}`)
    delete draft.fences[args.id]
    if (Object.keys(draft.fences).length === 0) delete draft.fences
    return { changed: [args.id] }
  },
})

export type FenceReport = Fence & { label: string; length: number }

export function fenceReport(doc: HouseDocument): FenceReport[] | undefined {
  const fences = Object.values(doc.fences ?? {})
  if (fences.length === 0) return undefined
  return fences.map((fence) => ({
    ...fence,
    label: FENCES[fence.kind].label,
    length: Math.round(fenceLength(fence)),
  }))
}
