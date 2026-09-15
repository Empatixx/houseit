import { moveWall } from '@houseit/commands/move-wall'
import { applyCommand, runScript } from '@houseit/commands/run'
import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import { roomsOf } from '@houseit/geometry/rooms'
import { SIDES } from '@houseit/geometry/sides'
import { expect, test } from 'vitest'
import { alignWallShift, wallMoveArgsOf, wallNamedBy } from './wall-move'

const SHAPES: Record<string, string> = {
  rectangle: [
    'add-room --material natural-oak --shape rectangle --width 10m --depth 8m --name flat',
    'add-room --material beech --from flat --name bedroom --side north --depth 3m',
    'add-room --material tile-white --from flat --name bath --side west --width 2m',
    'add-room --material tile-slate --from bath --name wc --side south --depth 1.6m',
  ].join('\n'),
  l: [
    'add-room --material natural-oak --shape l --width 10m --depth 8m --notch-width 3.5m --notch-depth 4m --name flat',
    'add-room --material beech --from flat --corner north-west --width 6.5m --depth 4m --name wing',
    'add-room --material beech --from wing --side west --depth 2.8m --name child',
    'add-room --material tile-white --from flat --side west --depth 3.9m --name block',
    'add-room --material tile-beige --from block --side north --depth 1.4m --name hall',
    'add-room --material tile-slate --from block --side east --depth 1.5m --name wc',
  ].join('\n'),
  u: [
    'add-room --material natural-oak --shape u --width 12m --depth 8m --notch-width 4m --notch-depth 4m --name flat',
    'add-room --material beech --from flat --side west --width 3m --name left',
    'add-room --material beech --from flat --side east --width 3m --name right',
  ].join('\n'),
  t: [
    'add-room --material natural-oak --shape t --width 12m --depth 9m --bar-depth 3m --stem-width 4m --name flat',
    'add-room --material beech --from flat --side north --depth 2.5m --name top',
  ].join('\n'),
}

const levelOf = (doc: HouseDocument) => Object.keys(doc.levels)[0]!

const everyWall = (doc: HouseDocument) => {
  const level = levelOf(doc)
  return roomsOf(doc, level)
    .filter((room) => room.name)
    .flatMap((room) => boundaryWallsOf(doc, level, room).map((wall) => ({ room, wall, level })))
}

test('wall alignment preserves an exact millimetre target through the room command adapter', () => {
  const initial = runScript(createEmptyDocument(), SHAPES.rectangle!)
  const { room, wall, level } = everyWall(initial).find(({ wall }) =>
    [initial.nodes[wall.a]!, initial.nodes[wall.b]!].every((p) => p.y === 8000),
  )!
  const doc = runScript(initial, `update-room --room ${room.id} --wall ${wall.id} --by -1263`)
  const moved = doc.walls[wall.id]!
  const shift = alignWallShift(doc, moved, { x: 0, y: -6732 }, 10)
  expect(shift).toEqual({ x: 0, y: -6737 })
  expect(Math.abs(wallMoveArgsOf(doc, level, moved, shift, room.id)!.by)).toBe(6737)
  expect(alignWallShift(doc, moved, { x: 0, y: -6700 }, 10)).toEqual({ x: 0, y: -6700 })
})

test.each(Object.keys(SHAPES))(
  'in a %s plan every wall names the room whose handle was grabbed',
  (shape) => {
    const doc = runScript(createEmptyDocument(), SHAPES[shape]!)
    const wrong: string[] = []
    for (const { room, wall, level } of everyWall(doc)) {
      const named = wallNamedBy(doc, level, wall, room.id)
      if (named?.room.name !== room.name) {
        wrong.push(`${room.name} grabbed ${wall.id} but it named ${named?.room.name ?? 'nothing'}`)
      }
    }
    expect(wrong).toEqual([])
  },
)

test.each(Object.keys(SHAPES))(
  'in a %s plan a wall dragged away from its room never asks for the opposite move',
  (shape) => {
    const doc = runScript(createEmptyDocument(), SHAPES[shape]!)
    const backwards: string[] = []
    for (const { room, wall, level } of everyWall(doc)) {
      const named = wallNamedBy(doc, level, wall, room.id)
      if (!named) continue
      const { axis, low } = SIDES[named.side]
      for (const away of [true, false]) {
        const push = (away ? 1 : -1) * (low ? -1 : 1) * 300
        const shift = axis === 'x' ? { x: push, y: 0 } : { x: 0, y: push }
        const args = wallMoveArgsOf(doc, level, wall, shift, room.id)
        if (!args) continue
        if (args.room !== (room.id ?? room.name)) {
          backwards.push(`${room.name}/${wall.id}: went to ${args.room}`)
        }
        const wanted = away ? 300 : -300
        if (args.by !== wanted) {
          backwards.push(
            `${room.name}/${wall.id} ${named.side}: dragged ${away ? 'out' : 'in'} asked for ${args.by}`,
          )
        }
      }
    }
    expect(backwards).toEqual([])
  },
)

test.each(Object.keys(SHAPES))(
  'in a %s plan the move the drag asks for is one the plan accepts or refuses by name',
  (shape) => {
    const start = runScript(createEmptyDocument(), SHAPES[shape]!)
    const broke: string[] = []
    for (const { room, wall, level } of everyWall(start)) {
      for (const away of [true, false]) {
        const named = wallNamedBy(start, level, wall, room.id)
        if (!named) continue
        const { axis, low } = SIDES[named.side]
        const push = (away ? 1 : -1) * (low ? -1 : 1) * 300
        const shift = axis === 'x' ? { x: push, y: 0 } : { x: 0, y: push }
        const args = wallMoveArgsOf(start, level, wall, shift, room.id)
        if (!args) continue
        try {
          applyCommand(start, moveWall, args)
        } catch (error) {
          const said = error instanceof Error ? error.message : String(error)
          if (!said.startsWith('move-wall:')) broke.push(`${room.name}/${wall.id}: ${said}`)
        }
      }
    }
    expect(broke).toEqual([])
  },
)
