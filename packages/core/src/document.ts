import { z } from 'zod'
import { HostSchema } from './host'
import { ROOM_KIND_IDS } from './room-kinds'

/** Bumped whenever the stored shape changes; see `migrate`. */
export const DOCUMENT_VERSION = 3

/**
 * Every length in the document is a whole number of millimetres. Floating point
 * coordinates drift, drifted nodes stop coinciding, and face detection produces
 * garbage once they do.
 */
const mm = z.number().int()
const id = z.string().min(1)

export const DisciplineSchema = z.enum(['architecture', 'electrical', 'plumbing', 'hvac'])

export const LevelSchema = z.object({
  id,
  name: z.string(),
  /** Height of this level's floor above the project origin. */
  elevation: mm,
  /** Floor-to-floor height, used as the default wall height. */
  height: mm.positive(),
})

/** A point in the plan graph. Walls reference nodes; nodes never move on their own. */
export const NodeSchema = z.object({ id, x: mm, y: mm })

export const WallSchema = z.object({
  id,
  level: id,
  a: id,
  b: id,
  thickness: mm.positive(),
  /** Offset of the wall base above its level's floor. */
  baseOffset: mm,
  height: mm.positive(),
})

export const OpeningSchema = z.object({
  id,
  wall: id,
  /** Centre of the opening along the wall, 0 at end `a` and 1 at end `b`. */
  t: z.number().min(0).max(1),
  kind: z.enum(['door', 'window']),
  /**
   * What sort of door it is, which is what decides how it is drawn: a hinged
   * leaf with its swing, two sliding panels, a leaf that pockets into the wall, or
   * a garage door across the whole opening. A window ignores it.
   */
  variant: z.enum(['hinged', 'sliding', 'pocket', 'garage']).default('hinged'),
  width: mm.positive(),
  height: mm.positive(),
  sillHeight: mm.nonnegative(),
  /** Which end of a door's opening the leaf hangs on. Ignored for a window. */
  hinge: z.enum(['a', 'b']).default('a'),
  /**
   * Which side of the wall a door swings towards, as a sign across it: the same
   * sense as a quarter turn counter-clockwise from `a` to `b`. Ignored for a
   * window. Stored rather than derived, because the room it opens into is a face
   * of the wall graph and faces have no lasting identity.
   */
  swing: z.union([z.literal(-1), z.literal(1)]).default(1),
})

/**
 * A room. Its identity is stored; its shape is not.
 *
 * The shape is a face of the wall graph, recomputed after every edit, so it can
 * never be a stable place to hang anything on. What is stored is a record with an
 * id and an anchor point, and after each edit the record is matched to whichever
 * face now contains that point. That is what lets a floor finish, a name stick,
 * and later a socket belong to the kitchen while a partition moves around it.
 */
export const RoomSchema = z.object({
  id,
  level: id,
  /** Anchor point, in millimetres. The record binds to the face containing it. */
  x: mm,
  y: mm,
  name: z.string(),
  /** Id from the floor material catalogue. Absent means a plain floor. */
  floor: z.string().optional(),
  /** What sort of room it is, from `room-kinds`. Absent, the name is read for it. */
  kind: z.enum(ROOM_KIND_IDS as [string, ...string[]]).optional(),
})

export const SideSchema = z.enum(['north', 'south', 'east', 'west'])

/**
 * Something standing in a room: a table, a chair.
 *
 * It belongs to a room, not to a wall. A wall gets split the moment another room
 * is cut beside it, and everything measured along that wall stops meaning what it
 * meant; a room is recomputed from the graph after every edit and survives. So a
 * table is stored as "in the kitchen, a third of the way across" and is still
 * that after the disposition changes underneath it.
 */
export const ObjectSchema = z.object({
  id,
  level: id,
  room: id,
  type: z.string().min(1),
  /** The side it backs onto. Absent means it stands out in the room. */
  against: SideSchema.optional(),
  /**
   * Which run of that side, counting from one west to east or south to north,
   * where the side has more than one — an L steps back to a second north wall.
   * Absent means the longest run, which is the only one a rectangle has.
   */
  againstNth: z.number().int().positive().optional(),
  /** Where along that side, 0 at one end and 1 at the other. */
  along: z.number().min(0).max(1).default(0.5),
  /**
   * For a thing standing free: how far up the room it stands, 0 at the south
   * and 1 at the north. Absent means the middle of the room, which is where a
   * free-standing thing goes unless the middle is taken.
   */
  across: z.number().min(0).max(1).optional(),
  width: mm.positive(),
  depth: mm.positive(),
  surface: z.string().min(1),
  /**
   * A turn about its own middle, in whole degrees, on top of the way it already
   * faces where it stands. Absent means square on, which nearly everything is.
   *
   * A stored angle rather than a verb: turning a thing is `update-object
   * --rotation`, the same way making it wider is `--width`. There is no more a
   * command for turning than there is one for widening.
   */
  rotation: z.number().int().min(-359).max(359).optional(),
  /** Places at a table. Ignored by everything without them. */
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
  /** Explicit cable run. Left out, the route is derived along walls and ceilings. */
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

/**
 * A room's shape is absent by design: it is a face of the wall graph, recomputed after
 * every edit rather than stored. See `@houseit/geometry`.
 */
export const DocumentSchema = DocumentShape.superRefine((doc, ctx) => {
  checkKeysMatchIds(doc.levels, 'levels', ctx)
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
