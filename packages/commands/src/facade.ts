import type { Exterior } from '@houseit/core/exterior'
import { FACADE_MATERIAL_IDS, facadeMaterial } from '@houseit/core/facade-materials'
import { HOUSE_STYLE_IDS, HOUSE_STYLES, houseStyle } from '@houseit/core/house-styles'
import { levelsOf } from '@houseit/core/levels'
import { exteriorSides } from '@houseit/geometry/exterior'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { levelOf, SIDE_NAMES } from './resolve'
import { addRoof } from './roofs'

const colour = z.string().regex(/^#[0-9a-f]{6}$/i)

export const updateFacade = defineCommand({
  name: 'update-facade',
  summary: `Dress the outside of the house (${FACADE_MATERIAL_IDS.join(', ')}). Without more it covers every exterior wall of every storey; --side north|south|east|west keeps to the walls facing that way, --level to one storey, and --from/--to (mm above that storey's floor) to a band of it, such as a stone plinth or a wooden upper half. --colour tints a render. Later bands replace what they overlap`,
  args: z.object({
    material: z.enum(FACADE_MATERIAL_IDS as [string, ...string[]]),
    colour: colour.optional(),
    side: z.enum(SIDE_NAMES).optional(),
    level: z.string().optional(),
    from: length().optional(),
    to: length().optional(),
  }),
  run: (draft, args) => {
    const material = facadeMaterial(args.material)!
    const tint = args.colour ?? material.colour
    if ((args.from === undefined) !== (args.to === undefined))
      throw new CommandError('update-facade: a band needs both --from and --to')
    if (args.from !== undefined && args.to! <= args.from)
      throw new CommandError('update-facade: --to must be above --from')
    const levels = args.level
      ? [levelOf(draft, args.level, 'update-facade')]
      : levelsOf(draft).map((storey) => storey.id)
    const changed: string[] = []
    for (const level of levels) {
      const outside = exteriorSides(draft, level)
      const rooms = roomsOf(draft, level)
      const height = draft.levels[level]!.height
      for (const id of outside.keys()) {
        const wall = draft.walls[id]
        const a = wall && draft.nodes[wall.a]
        const b = wall && draft.nodes[wall.b]
        if (!wall || !a || !b || wall.level !== level) continue
        const run = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const normal = { x: -(b.y - a.y) / run, y: (b.x - a.x) / run }
        const probe = {
          x: (a.x + b.x) / 2 + normal.x * wall.thickness,
          y: (a.y + b.y) / 2 + normal.y * wall.thickness,
        }
        const indoors = rooms.some(
          (room) =>
            room.id &&
            containsPoint(
              room.nodes.map((node) => draft.nodes[node]!),
              probe.x,
              probe.y,
            ),
        )
        const out = indoors ? { x: -normal.x, y: -normal.y } : normal
        const facing =
          Math.abs(out.x) > Math.abs(out.y)
            ? out.x > 0
              ? 'east'
              : 'west'
            : out.y > 0
              ? 'north'
              : 'south'
        if (args.side && facing !== args.side) continue
        const coat: Exterior = wall.exterior ?? {
          layers: [{ name: 'render', thickness: 20 }],
          colour: '#ecebe6',
          base: 0,
          bands: [],
        }
        if (args.from !== undefined) {
          const top = Math.min(args.to!, height - wall.baseOffset)
          if (top <= args.from) continue
          coat.bands = [
            ...coat.bands.filter(
              (band) => band.along !== undefined || band.to <= args.from! || band.from >= top,
            ),
            { from: args.from, to: top, colour: tint, material: material.id },
          ].sort((one, other) => one.from - other.from)
        } else {
          coat.material = material.id
          coat.colour = tint
          coat.bands = coat.bands.filter((band) => band.along !== undefined)
        }
        wall.exterior = coat
        changed.push(wall.id)
      }
    }
    if (changed.length === 0)
      throw new CommandError(
        `update-facade: no exterior wall${args.side ? ` faces ${args.side}` : ''} there`,
      )
    return { changed }
  },
})

export const updateHouse = defineCommand({
  name: 'update-house',
  summary: `Give the whole house a look in one go, roof and facade together: --style ${HOUSE_STYLES.map((style) => `${style.id} (${style.label})`).join('; ')}. It is add-roof and update-facade, so either can refine it afterwards`,
  args: z.object({ style: z.enum(HOUSE_STYLE_IDS as [string, ...string[]]) }),
  run: (draft, args, open) => {
    const style = houseStyle(args.style)!
    const walls = facadeMaterial(style.facade)?.colour ?? '#ecebe6'
    const changed = [
      ...(updateFacade.apply(
        draft,
        { material: style.facade, ...(style.colour ? { colour: style.colour } : {}) },
        open,
      )?.changed ?? []),
      ...(style.accent
        ? (updateFacade.apply(
            draft,
            { material: style.accent.material, side: style.accent.side },
            open,
          )?.changed ?? [])
        : []),
      ...(style.plinth
        ? (updateFacade.apply(
            draft,
            {
              material: style.plinth.material,
              from: 0,
              to: style.plinth.height,
              level: levelsOf(draft)[0]!.id,
            },
            open,
          )?.changed ?? [])
        : []),
      ...(addRoof.apply(
        draft,
        {
          shape: style.roof.shape,
          ...(style.roof.pitch ? { pitch: style.roof.pitch } : {}),
          ...(style.roof.covering ? { covering: style.roof.covering } : {}),
          walls,
        },
        open,
      )?.changed ?? []),
    ]
    return { changed: [...new Set(changed)] }
  },
})
