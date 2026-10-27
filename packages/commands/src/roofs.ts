import { levelsOf } from '@houseit/core/levels'
import type { Roof } from '@houseit/core/roof'
import {
  type End,
  outlineOf,
  pitchedFacets,
  type Rect,
  ROOF_SHAPES,
  rectanglesOf,
} from '@houseit/core/roof-shapes'
import { storeyOutline } from '@houseit/geometry/storey-outline'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { levelOf } from './resolve'

export const ROOF_COVERINGS = [
  'roof-tiles',
  'roof-tiles-anthracite',
  'standing-seam',
  'slate',
  'shingles',
] as const

const EAVE = 40
const PLATE = 160
const colour = z.string().regex(/^#[0-9a-f]{6}$/i)
type Side = 'north' | 'south' | 'east' | 'west'

function touching(rect: Rect, other: Rect): Side | undefined {
  const spanX = Math.min(rect.x1, other.x1) - Math.max(rect.x0, other.x0)
  const spanY = Math.min(rect.y1, other.y1) - Math.max(rect.y0, other.y0)
  if (spanY > 0 && rect.x1 === other.x0) return 'east'
  if (spanY > 0 && rect.x0 === other.x1) return 'west'
  if (spanX > 0 && rect.y1 === other.y0) return 'north'
  if (spanX > 0 && rect.y0 === other.y1) return 'south'
  return undefined
}

export const addRoof = defineCommand({
  name: 'add-roof',
  summary: `Roof the top storey (or --level) over its whole outline: --shape ${ROOF_SHAPES.join('|')}, --pitch in degrees (default 35, a shed 10), --overhang past the walls (default 500mm), --ridge east-west|north-south (default along the longer side), --covering ${ROOF_COVERINGS.join('|')}, --towards for the low side of a shed. An L or T house gets a roof over each wing, its ridge running into the main one. --walls #rrggbb colours the gables. It replaces the storey's roofs`,
  args: z.object({
    level: z.string().optional(),
    shape: z.enum(ROOF_SHAPES),
    pitch: z.coerce.number().min(5).max(60).optional(),
    overhang: length().optional(),
    ridge: z.enum(['east-west', 'north-south']).optional(),
    covering: z.enum(ROOF_COVERINGS).optional(),
    towards: z.enum(['north', 'south', 'east', 'west']).optional(),
    colour: colour.optional(),
    walls: colour.optional(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? levelsOf(draft).at(-1)?.id ?? open, 'add-roof')
    const storey = draft.levels[level]!
    const outline = storeyOutline(draft, level)
    if (!outline) throw new CommandError(`add-roof: ${storey.name} has no rooms to roof`)
    if (
      outline.some((a, i) => {
        const b = outline[(i + 1) % outline.length]!
        return a.x !== b.x && a.y !== b.y
      })
    )
      throw new CommandError('add-roof: only a house of square corners can be roofed this way')

    if (args.shape === 'flat') {
      storey.roofs = [
        {
          name: 'Roof',
          outline,
          finish: 'membrane',
          depth: 300,
          baseOffset: 0,
          parapet: { height: 300, thickness: 300, colour: args.walls ?? '#e9e7e2', coping: 40 },
          fall: { percent: 2, towards: args.towards ?? 'south' },
          drains: [],
          ...(args.colour ? { colour: args.colour } : {}),
        },
      ]
      return { changed: [level] }
    }

    const rects = rectanglesOf(outline)
    const pitch = args.pitch ?? (args.shape === 'shed' ? 10 : 35)
    const slope = Math.tan((pitch * Math.PI) / 180)
    const overhang = args.overhang ?? 500
    const roofs: Roof[] = rects.map((rect, index) => {
      const width = rect.x1 - rect.x0
      const depth = rect.y1 - rect.y0
      let axis: 'x' | 'y' =
        index === 0 && args.ridge
          ? args.ridge === 'east-west'
            ? 'x'
            : 'y'
          : width >= depth
            ? 'x'
            : 'y'
      const joined = rects
        .slice(0, index)
        .map((other) => touching(rect, other))
        .find((side) => side !== undefined)
      const hanging = { north: overhang, south: overhang, east: overhang, west: overhang }
      let ends: [End, End] = args.shape === 'hip' ? ['hip', 'hip'] : ['gable', 'gable']
      let shape: 'gable' | 'hip' | 'shed' =
        args.shape === 'shed' ? 'shed' : args.shape === 'hip' ? 'hip' : 'gable'
      let towards = args.towards
      let area = { ...rect }
      if (shape === 'shed') {
        towards = towards ?? 'south'
        axis = towards === 'north' || towards === 'south' ? 'x' : 'y'
      }
      if (joined) {
        hanging[joined] = 0
        const main = rects[0]!
        const mainHalf = Math.min(main.x1 - main.x0, main.y1 - main.y0) / 2
        const alongAxis = joined === 'east' || joined === 'west' ? 'x' : 'y'
        const wingHalf = (alongAxis === 'x' ? depth : width) / 2
        if (shape !== 'shed' && wingHalf <= mainHalf) {
          axis = alongAxis
          const reach = Math.round(wingHalf + overhang)
          if (joined === 'east') area = { ...area, x1: area.x1 + reach }
          if (joined === 'west') area = { ...area, x0: area.x0 - reach }
          if (joined === 'north') area = { ...area, y1: area.y1 + reach }
          if (joined === 'south') area = { ...area, y0: area.y0 - reach }
          const next: [End, End] = [...ends]
          next[joined === 'west' || joined === 'south' ? 0 : 1] = 'gable'
          ends = next
        } else {
          shape = 'shed'
          towards = ({ north: 'south', south: 'north', east: 'west', west: 'east' } as const)[
            joined
          ]
          axis = joined === 'north' || joined === 'south' ? 'x' : 'y'
        }
      }
      const pitched = {
        shape,
        pitch,
        axis,
        ends,
        ...(shape === 'shed' ? { towards: towards ?? 'south' } : {}),
        eave: EAVE,
      } as const
      return {
        name: index === 0 ? 'Roof' : `Roof wing ${index}`,
        outline: outlineOf(area),
        finish: 'membrane',
        depth: EAVE,
        baseOffset: 0,
        material: args.covering ?? 'roof-tiles',
        ...(args.colour ? { colour: args.colour } : {}),
        facets: pitchedFacets(area, pitched),
        parapet: { height: 0, thickness: 1, colour: '#000000', coping: 20 },
        fall: { percent: 0, towards: 'south' },
        drains: [],
        pitched: {
          ...pitched,
          plate: PLATE,
          overhang: hanging,
          walls: args.walls ?? '#ecebe6',
          fascia: '#3b3e42',
        },
      }
    })
    storey.roofs = roofs
    return {
      changed: [level],
      notes: [
        `${roofs.length} roof part${roofs.length === 1 ? '' : 's'} over ${storey.name}, ${pitch}° at ${Math.round(slope * 100)} %`,
      ],
    }
  },
})

export const removeRoof = defineCommand({
  name: 'remove-roof',
  summary: 'Take the roof off the top storey (or --level)',
  args: z.object({ level: z.string().optional() }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? levelsOf(draft).at(-1)?.id ?? open, 'remove-roof')
    const storey = draft.levels[level]!
    if (!storey.roofs?.length) throw new CommandError(`remove-roof: ${storey.name} has no roof`)
    delete storey.roofs
    return { changed: [level] }
  },
})
