import type { HouseDocument, Opening } from '@houseit/core/document'
import { DOOR_VARIANTS, OpeningSchema } from '@houseit/core/document'
import { FrameSchema, PanelsSchema } from '@houseit/core/opening-assembly'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { wallElement } from '@houseit/geometry/wall-elements'
import type { Draft } from 'immer'
import { z } from 'zod'
import { along, alongSide, fractionOf } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { directionAt, hasDoor, opensIntoOf, touchesWall } from './opening-direction'
import { checkFrame } from './opening-frame'
import { handOf, hingeAt } from './opening-hinge'
import { openingById, roomOfOpening } from './openings'
import { checkDoorLeaves, checkOpeningAt, placeOpening, placeOpeningAt } from './place-opening'
import { checkPockets, pocketDirection, setPocket } from './pocket-door'
import { SIDE_NAMES, sideNamed } from './resolve'

import { validateWallHosts } from './validate-wall-hosts'
import { validateWalls } from './wall'

export const updateOpening = defineCommand({
  name: 'update-opening',
  summary: `For pocket doors, --slide-towards north|south|east|west chooses the wall pocket; omitted, a free side is chosen. Change a door or a window: its size, its kind of leaf (${DOOR_VARIANTS.join(', ')}), or where in the wall it sits. --hinge left|right is viewed from the side it opens towards, facing the closed door. --opens-into names the room receiving the leaf, or outside. --leaf-width changes the main leaf of a paired door; 0 restores one leaf`,
  args: z.object({
    id: z.string().min(1),
    towards: z.enum(['left', 'right']).optional(),
    panels: json(PanelsSchema).optional(),
    frame: json(FrameSchema).optional(),
    width: length().optional(),
    leafWidth: length().optional(),
    height: length().optional(),
    sill: length().optional(),
    variant: z.enum(['hinged', 'sliding', 'pocket', 'garage']).optional(),
    hinge: z.enum(['left', 'right']).optional(),
    opensInto: z.string().min(1).optional(),
    slideTowards: z.enum(SIDE_NAMES).optional(),
    along: along().optional(),
    toSide: z.enum(SIDE_NAMES).optional(),
    toWall: z.string().min(1).optional(),
  }),
  run: (draft, args) => {
    const existing = draft.openings[args.id]
    if (!existing)
      throw new CommandError(`update-opening: there is no door or window called ${args.id}`)
    const host = draft.walls[existing.wall]!
    const beside = roomOfOpening(draft, roomsOf(draft, host.level), existing)
    const direct = args.toWall !== undefined || args.towards !== undefined || !beside?.id
    if (direct) {
      if (args.toSide)
        throw new CommandError('update-opening: direct placement uses --to-wall, not --to-side')
      if (args.opensInto && args.towards)
        throw new CommandError('update-opening: use --opens-into or --towards')
      if (!Object.entries(args).some(([key, value]) => key !== 'id' && value !== undefined))
        throw new CommandError('update-opening: say what to change')
      if (existing.kind !== 'door' && args.variant)
        throw new CommandError('update-opening: a window has no door variant')
      if (existing.kind === 'door' && args.sill !== undefined)
        throw new CommandError('update-opening: a door starts on the floor')
      const run = wallElement(draft, args.toWall ?? existing.wall)
      const oldRun = wallElement(draft, existing.wall)
      const oldSegment = oldRun.segments.find((s) => s.wall.id === existing.wall)!
      const oldDistance = oldSegment.from + existing.t * (oldSegment.to - oldSegment.from)
      const at =
        args.along === undefined
          ? args.toWall
            ? run.length / 2
            : oldDistance
          : fractionOf(args.along, run, 'update-opening') * run.length
      const width = args.width ?? existing.width
      const segment = run.segments.find((s) => at - width / 2 >= s.from && at + width / 2 <= s.to)
      if (!segment)
        throw new CommandError('update-opening: the opening must fit between wall junctions')
      const hand = args.hinge ?? handOf(existing)
      existing.wall = segment.wall.id
      existing.t = (at - segment.from) / (segment.to - segment.from)
      if (args.variant !== undefined) existing.variant = args.variant
      existing.width = width
      if (args.height !== undefined) existing.height = args.height
      if (args.sill !== undefined) existing.sillHeight = args.sill
      if (args.leafWidth !== undefined) existing.leafWidth = args.leafWidth || undefined
      if (args.frame !== undefined) existing.frame = args.frame
      if (args.panels !== undefined) existing.panels = args.panels
      const leaf = hasDoor(existing) && existing.variant === 'hinged'
      if (!leaf && (args.hinge || args.opensInto || args.towards))
        throw new CommandError('update-opening: swing and hinge need a hinged door')
      if (args.towards) existing.swing = args.towards === 'left' ? 1 : -1
      const adjacent = roomsOf(draft, run.level).find((r) => touchesWall(r, segment.wall))
      if (args.opensInto) {
        if (!adjacent) throw new CommandError('update-opening: --opens-into needs an adjacent room')
        existing.swing = directionAt(
          draft,
          run.level,
          segment.wall.id,
          adjacent,
          args.opensInto,
          'update-opening',
        )
      }
      if (leaf) existing.hinge = hingeAt(existing.swing, hand)
      setPocket(draft, existing, args.slideTowards, 'update-opening')
      OpeningSchema.parse(existing)
      validateWalls(draft, run.level)
      if (adjacent) checkDoorLeaves(draft, run.level, adjacent, existing, 'update-opening')
      return { changed: [existing.id, oldRun.id, run.id], at: run.level }
    }
    const found = openingById(draft, args.id, 'update-opening')
    const { opening, room, level } = found
    const door = opening.kind === 'door'

    if (args.variant !== undefined && !door) {
      throw new CommandError('update-opening: a window has no leaf, so no --variant')
    }
    if (args.sill !== undefined && door) {
      throw new CommandError('update-opening: a door starts on the floor, so it has no --sill')
    }
    const moving =
      args.toSide !== undefined || args.toWall !== undefined || args.along !== undefined
    const resizing =
      args.width !== undefined || args.height !== undefined || args.sill !== undefined
    if (
      !moving &&
      !resizing &&
      args.leafWidth === undefined &&
      args.variant === undefined &&
      args.hinge === undefined &&
      args.opensInto === undefined &&
      args.slideTowards === undefined &&
      args.panels === undefined &&
      args.frame === undefined
    ) {
      throw new CommandError(
        'update-opening: say what to change — --width, --height, --sill, --variant, --hinge, --opens-into, --along, --to-side or --to-wall',
      )
    }

    const variant = args.variant ?? opening.variant
    const slideTowards =
      args.slideTowards ??
      (moving && opening.variant === 'pocket' && variant === 'pocket'
        ? pocketDirection(draft, opening)
        : undefined)
    const width = args.width ?? opening.width
    const leafWidth = args.leafWidth === undefined ? opening.leafWidth : args.leafWidth || undefined
    const swings =
      door &&
      variant === 'hinged' &&
      leafWidth === undefined &&
      (args.frame ?? opening.frame)?.inset === undefined
    const leaf =
      hasDoor({ kind: opening.kind, panels: args.panels ?? opening.panels }) && variant === 'hinged'
    if (args.opensInto !== undefined && !leaf)
      throw new CommandError('update-opening: --opens-into needs a hinged door or a door panel')
    if (args.hinge !== undefined && !leaf)
      throw new CommandError('update-opening: --hinge needs a hinged door')
    const hand = args.hinge ?? handOf(opening)
    const into =
      args.opensInto ?? (leaf ? opensIntoOf(draft, roomsOf(draft, level), opening) : undefined)

    if (moving) {
      const at =
        args.toSide !== undefined || args.toWall !== undefined
          ? sideNamed(
              draft,
              level,
              room,
              { side: args.toSide, wall: args.toWall },
              'update-opening',
            )
          : { side: found.side, nth: found.run }
      const spot =
        args.along !== undefined
          ? placeOpeningAt(
              draft,
              level,
              room,
              at.side,
              width,
              alongSide(draft, level, room, at, args.along, 'update-opening'),
              'update-opening',
              swings,
              opening.id,
              at.nth,
              into,
            )
          : placeOpening(
              draft,
              level,
              room,
              at.side,
              width,
              'update-opening',
              swings,
              opening.id,
              at.nth,
              at.wall,
              into,
            )
      const target = draft.openings[opening.id]!
      target.wall = spot.wall
      target.t = spot.t
      if (leaf) target.swing = spot.swing
    } else if (
      resizing ||
      args.leafWidth !== undefined ||
      args.variant !== undefined ||
      args.opensInto !== undefined
    ) {
      const swing = refit(draft, level, room, opening, width, swings, 'update-opening', into)
      if (leaf) draft.openings[opening.id]!.swing = swing
    }

    const target = draft.openings[opening.id]!
    if (variant !== 'pocket') target.slide = undefined
    target.leafWidth = leafWidth
    target.width = width
    target.variant = variant
    if (leaf && (moving || args.hinge !== undefined)) target.hinge = hingeAt(target.swing, hand)
    if (args.height !== undefined) target.height = args.height
    if (args.sill !== undefined) target.sillHeight = args.sill
    if (args.panels !== undefined) target.panels = args.panels
    if (args.frame !== undefined) target.frame = args.frame
    OpeningSchema.parse(target)
    checkFrame(draft, target, 'update-opening')
    setPocket(draft, target, slideTowards, 'update-opening')
    checkDoorLeaves(draft, level, room, target, 'update-opening')
    checkPockets(draft, level, 'update-opening')
    validateWallHosts(draft, level)
    return { changed: [opening.id] }
  },
})

function refit(
  draft: Draft<HouseDocument>,
  level: string,
  room: Room & { id: string },
  found: Opening,
  width: number,
  swings: boolean,
  what: string,
  into?: string,
) {
  const wall = draft.walls[found.wall]
  const a = wall && draft.nodes[wall.a]
  const b = wall && draft.nodes[wall.b]
  if (!wall || !a || !b) throw new CommandError(`${what}: the wall it is in is gone`)
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  return checkOpeningAt(
    draft,
    level,
    room,
    found.wall,
    found.t * span,
    width,
    what,
    swings,
    found.id,
    into,
  )
}
