import { ColumnSchema } from '@houseit/core/column'
import type { HouseDocument } from '@houseit/core/document'
import { areaInBox } from '@houseit/geometry/area-in-box'
import { boxOf, clashesAny, wallBox } from '@houseit/geometry/boxes'
import { shaftOutside, shaftsOn } from '@houseit/geometry/connections'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { levelOf } from './resolve'

const colour = ColumnSchema.shape.colour
const dimensions = {
  x: length(),
  y: length(),
  width: length(),
  depth: length(),
  colour,
  embedded: z.coerce.boolean().optional(),
  outside: z.coerce.boolean().optional(),
}
export const addColumn = defineCommand({
  name: 'add-column',
  summary:
    'Place a structural column on a storey grid, from its floor to its soffit. Coordinates are in mm; --outside permits an exterior support beyond enclosed rooms.',
  args: z.object({ ...dimensions, level: z.string().optional() }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'add-column')
    const all = Object.fromEntries(
      Object.values(draft.levels).flatMap((l) => (l.columns ?? []).map((c) => [c.id, c])),
    )
    const column = ColumnSchema.parse({ ...args, id: allocateId(all, 'col') })
    checkColumn(draft, level, column)
    const record = draft.levels[level]!
    record.columns ??= []
    record.columns.push(column)
    return {
      changed: [column.id],
      shown: roomsOf(draft, level).flatMap((r) => (r.id ? [r.id] : [])),
      at: level,
    }
  },
})
export const updateColumn = defineCommand({
  name: 'update-column',
  summary: 'Change a structural column by id; its height continues to follow its storey soffit.',
  args: z.object({
    column: z.string(),
    ...Object.fromEntries(Object.entries(dimensions).map(([k, v]) => [k, v.optional()])),
  }),
  run: (draft, args) => {
    const { level, column } = findColumn(draft, args.column)
    const next = ColumnSchema.parse({
      ...column,
      ...Object.fromEntries(
        Object.entries(args).filter(([k, v]) => k !== 'column' && v !== undefined),
      ),
    })
    checkColumn(draft, level.id, next)
    Object.assign(column, next)
    return {
      changed: [column.id],
      shown: roomsOf(draft, level.id).flatMap((r) => (r.id ? [r.id] : [])),
      at: level.id,
    }
  },
})
export const removeColumn = defineCommand({
  name: 'remove-column',
  summary: 'Remove a structural column by id.',
  args: z.object({ column: z.string() }),
  run: (draft, args) => {
    const { level, column } = findColumn(draft, args.column)
    level.columns = level.columns!.filter((c) => c.id !== column.id)
    return { changed: [column.id], at: level.id }
  },
})
function findColumn(doc: HouseDocument, id: string) {
  for (const level of Object.values(doc.levels)) {
    const column = level.columns?.find((c) => c.id === id)
    if (column) return { level, column }
  }
  throw new CommandError(`no column ${id}`)
}
function checkColumn(doc: HouseDocument, level: string, column: z.infer<typeof ColumnSchema>) {
  const box = {
    x0: column.x - column.width / 2,
    y0: column.y - column.depth / 2,
    x1: column.x + column.width / 2,
    y1: column.y + column.depth / 2,
  }
  if (
    shaftsOn(doc, level).some(
      (s) => !s.aroundColumns && clashesAny([box], [boxOf(shaftOutside(s))]),
    )
  )
    throw new CommandError('column would intersect a lift shaft')
  for (const wall of Object.values(doc.walls).filter((w) => w.level === level)) {
    if (
      !column.embedded &&
      clashesAny([box], [wallBox(doc.nodes[wall.a]!, doc.nodes[wall.b]!, wall.thickness)])
    )
      throw new CommandError('column would intersect a wall')
  }
  for (const other of doc.levels[level]!.columns ?? []) {
    if (other.id === column.id) continue
    if (
      clashesAny(
        [box],
        [
          {
            x0: other.x - other.width / 2,
            y0: other.y - other.depth / 2,
            x1: other.x + other.width / 2,
            y1: other.y + other.depth / 2,
          },
        ],
      )
    )
      throw new CommandError('column would intersect another column')
  }
  const room = roomsOf(doc, level).find((r) =>
    column.embedded
      ? areaInBox(
          r.nodes.map((id) => doc.nodes[id]!),
          box,
        ) > 0
      : containsPoint(
          r.nodes.map((id) => doc.nodes[id]!),
          column.x,
          column.y,
        ),
  )
  if (!room && !column.outside)
    throw new CommandError(
      'column must stand inside the storey footprint; use --outside for an exterior support',
    )
  for (const object of Object.values(doc.objects).filter((o) => o.level === level)) {
    const where = roomsOf(doc, level).find((r) => r.id === object.room)
    const spot = where ? standingAt(doc, level, where, object) : undefined
    if (spot && clashesAny([box], piecesOf(spot, object).map(boxOf)))
      throw new CommandError(`column would intersect ${object.id}`)
  }
}
