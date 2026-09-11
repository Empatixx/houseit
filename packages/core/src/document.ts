import { z } from 'zod'
import { closes } from './closes'
import { ColumnSchema } from './column'
import { RampSchema, ShaftSchema } from './connections'
import { ExteriorSchema } from './exterior'
import { FINISH_IDS, isColour, STYLE_IDS } from './finishes'
import { HostSchema } from './host'
import { FrameSchema, PanelsSchema } from './opening-assembly'
import { RoofSchema } from './roof'
import { ROOM_KIND_IDS } from './room-kinds'

export const DOCUMENT_VERSION = 5

const mm = z.number().int()
const id = z.string().min(1)

export const DOOR_VARIANTS = ['hinged', 'sliding', 'pocket', 'garage'] as const

export const DisciplineSchema = z.enum(['architecture', 'electrical', 'plumbing', 'hvac'])

export const LevelSchema = z.object({
  id,
  name: z.string(),
  elevation: mm,
  slabThickness: mm.positive().optional(),
  columns: z.array(ColumnSchema).optional(),
  shafts: z.array(ShaftSchema).optional(),
  ramps: z.array(RampSchema).optional(),
  roofs: z.array(RoofSchema).optional(),
  height: mm.positive(),
})

export const NodeSchema = z.object({ id, x: mm, y: mm })

export const WallSchema = z.object({
  id,
  level: id,
  a: id,
  b: id,
  thickness: mm.positive(),
  exterior: ExteriorSchema.optional(),
  baseOffset: mm,
  height: mm.positive(),
})

export const OpeningSchema = z
  .object({
    id,
    wall: id,
    t: z.number().min(0).max(1),
    kind: z.enum(['door', 'window', 'assembly']),
    panels: PanelsSchema.optional(),
    frame: FrameSchema.optional(),
    variant: z.enum(DOOR_VARIANTS).default('hinged'),
    width: mm.positive(),
    height: mm.positive(),
    sillHeight: mm.nonnegative(),
    hinge: z.enum(['a', 'b']).default('a'),
    swing: z.union([z.literal(-1), z.literal(1)]).default(1),
  })
  .superRefine((opening, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (opening.kind === 'assembly' && (!opening.panels || !opening.frame))
      fail('an assembly needs panels and a frame')
    if (opening.kind !== 'assembly' && opening.panels) fail('panels belong to an assembly')
    if (!opening.panels) return
    let area = 0
    for (const [i, p] of opening.panels.entries()) {
      if (p.x + p.width > opening.width || p.z + p.height > opening.height)
        fail('panel extends outside the opening')
      if (p.kind === 'door' && p.z + opening.sillHeight !== 0)
        fail('an assembly door must start at the floor')
      area += p.width * p.height
      for (const q of opening.panels.slice(i + 1))
        if (
          p.x < q.x + q.width &&
          q.x < p.x + p.width &&
          p.z < q.z + q.height &&
          q.z < p.z + p.height
        )
          fail('assembly panels overlap')
    }
    if (area !== opening.width * opening.height) fail('panels must cover the opening exactly')
  })

const worn = z
  .string()
  .refine(
    (said) => isColour(said) || FINISH_IDS.includes(said),
    'not a finish, nor a #rrggbb colour',
  )

export const RoomSchema = z.object({
  id,
  level: id,
  x: mm,
  y: mm,
  name: z.string(),
  loop: z.array(id),
  floor: z.string().optional(),
  kind: z.enum(ROOM_KIND_IDS as [string, ...string[]]).optional(),
  style: z.enum(STYLE_IDS as [string, ...string[]]).optional(),
  walls: worn.optional(),
  ceiling: worn.optional(),
  doors: worn.optional(),
  windows: worn.optional(),
})

export const SideSchema = z.enum(['north', 'south', 'east', 'west'])

export const ObjectSchema = z.object({
  id,
  level: id,
  room: id,
  type: z.string().min(1),
  against: SideSchema.optional(),
  againstNth: z.number().int().positive().optional(),
  along: z.number().min(0).max(1).default(0.5),
  across: z.number().min(0).max(1).optional(),
  width: mm.positive(),
  depth: mm.positive(),
  surface: z.string().min(1),
  rotation: z.number().int().min(-359).max(359).optional(),
  seats: z.number().int().positive().optional(),
})

export const DeviceSchema = z.object({
  id,
  kind: z.enum(['socket', 'switch', 'light', 'panel']),
  discipline: DisciplineSchema,
  host: HostSchema,
  params: z.record(z.string(), z.unknown()).optional(),
})

export const CircuitSchema = z.object({
  id,
  panel: id,
  breaker: z.string(),
  devices: z.array(id),
  route: z.array(HostSchema).optional(),
})

const byId = <T extends z.ZodTypeAny>(entry: T) => z.record(z.string(), entry).default({})

const DocumentShape = z.object({
  version: z.literal(DOCUMENT_VERSION),
  levels: byId(LevelSchema),
  nodes: byId(NodeSchema),
  walls: byId(WallSchema),
  openings: byId(OpeningSchema),
  rooms: byId(RoomSchema),
  objects: byId(ObjectSchema),
  devices: byId(DeviceSchema),
  circuits: byId(CircuitSchema),
})

type Ctx = z.core.$RefinementCtx

function checkKeysMatchIds(record: Record<string, { id: string }>, collection: string, ctx: Ctx) {
  for (const [key, entity] of Object.entries(record)) {
    if (key !== entity.id) {
      ctx.addIssue({
        code: 'custom',
        path: [collection, key],
        message: `${collection} is keyed by ${key} but the entry carries id ${entity.id}`,
      })
    }
  }
}

function checkReference(
  target: Record<string, unknown>,
  ref: string,
  path: (string | number)[],
  what: string,
  ctx: Ctx,
) {
  if (!target[ref]) {
    ctx.addIssue({ code: 'custom', path, message: `${what} references unknown ${ref}` })
  }
}

export const DocumentSchema = DocumentShape.superRefine((doc, ctx) => {
  checkKeysMatchIds(doc.levels, 'levels', ctx)
  for (const level of Object.values(doc.levels)) {
    for (const connection of [...(level.shafts ?? []), ...(level.ramps ?? [])]) {
      checkReference(
        doc.levels,
        connection.to,
        ['levels', level.id, connection.id],
        'vertical connection',
        ctx,
      )
    }
  }
  checkKeysMatchIds(doc.nodes, 'nodes', ctx)
  checkKeysMatchIds(doc.walls, 'walls', ctx)
  checkKeysMatchIds(doc.openings, 'openings', ctx)
  checkKeysMatchIds(doc.rooms, 'rooms', ctx)
  checkKeysMatchIds(doc.objects, 'objects', ctx)
  checkKeysMatchIds(doc.devices, 'devices', ctx)
  checkKeysMatchIds(doc.circuits, 'circuits', ctx)

  for (const wall of Object.values(doc.walls)) {
    const at = (field: string) => ['walls', wall.id, field]
    checkReference(doc.levels, wall.level, at('level'), `wall ${wall.id}`, ctx)
    checkReference(doc.nodes, wall.a, at('a'), `wall ${wall.id}`, ctx)
    checkReference(doc.nodes, wall.b, at('b'), `wall ${wall.id}`, ctx)
  }

  for (const room of Object.values(doc.rooms)) {
    const at = ['rooms', room.id, 'loop']
    checkReference(doc.levels, room.level, ['rooms', room.id, 'level'], `room ${room.id}`, ctx)
    for (const wall of room.loop) {
      checkReference(doc.walls, wall, at, `room ${room.id}`, ctx)
    }
    if (room.loop.length > 0 && !closes(doc.walls, room.loop)) {
      ctx.addIssue({ code: 'custom', path: at, message: `room ${room.id} is not walled all round` })
    }
  }

  for (const opening of Object.values(doc.openings)) {
    const path = ['openings', opening.id, 'wall']
    checkReference(doc.walls, opening.wall, path, `opening ${opening.id}`, ctx)
  }

  for (const room of Object.values(doc.rooms)) {
    const path = ['rooms', room.id, 'level']
    checkReference(doc.levels, room.level, path, `room ${room.id}`, ctx)
  }

  for (const object of Object.values(doc.objects)) {
    const what = `object ${object.id}`
    checkReference(doc.levels, object.level, ['objects', object.id, 'level'], what, ctx)
    checkReference(doc.rooms, object.room, ['objects', object.id, 'room'], what, ctx)
  }

  for (const device of Object.values(doc.devices)) {
    const path = ['devices', device.id, 'host']
    const what = `device ${device.id}`
    if (device.host.kind === 'wall') {
      checkReference(doc.walls, device.host.wall, path, what, ctx)
    } else {
      checkReference(doc.levels, device.host.level, path, what, ctx)
    }
  }

  for (const circuit of Object.values(doc.circuits)) {
    const what = `circuit ${circuit.id}`
    checkReference(doc.devices, circuit.panel, ['circuits', circuit.id, 'panel'], what, ctx)
    circuit.devices.forEach((device, index) => {
      checkReference(doc.devices, device, ['circuits', circuit.id, 'devices', index], what, ctx)
    })
  }
})

export type Discipline = z.infer<typeof DisciplineSchema>
export type Level = z.infer<typeof LevelSchema>
export type Node = z.infer<typeof NodeSchema>
export type Wall = z.infer<typeof WallSchema>
export type Opening = z.infer<typeof OpeningSchema>
export type Room = z.infer<typeof RoomSchema>
export type Side = z.infer<typeof SideSchema>
export type HouseObject = z.infer<typeof ObjectSchema>
export type Device = z.infer<typeof DeviceSchema>
export type Circuit = z.infer<typeof CircuitSchema>
export type HouseDocument = z.infer<typeof DocumentSchema>

export function parseDocument(input: unknown): HouseDocument {
  return DocumentSchema.parse(input)
}

export function createEmptyDocument(): HouseDocument {
  const ground: Level = {
    id: crypto.randomUUID(),
    name: 'Ground floor',
    elevation: 0,
    height: 2800,
  }
  return {
    version: DOCUMENT_VERSION,
    levels: { [ground.id]: ground },
    nodes: {},
    walls: {},
    openings: {},
    rooms: {},
    objects: {},
    devices: {},
    circuits: {},
  }
}
