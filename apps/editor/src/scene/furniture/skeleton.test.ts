import type { HouseObject } from '@houseit/core/document'
import { OBJECT_TYPES } from '@houseit/core/object-types'
import { expect, test } from 'vitest'
import { type Corners, skeletonOf } from './skeleton'

const thing = (over: Partial<HouseObject> = {}): HouseObject => ({
  id: 'f1',
  level: 'l1',
  room: 'r1',
  type: 'table',
  along: 0.5,
  width: 1600,
  depth: 900,
  surface: 'oak',
  seats: 6,
  ...over,
})

const chairParts = () =>
  skeletonOf(thing({ type: 'chair', width: 460, depth: 500, seats: undefined }))

test('a chair is a curved back with a seat in front of it', () => {
  const parts = chairParts()
  const back = parts.find((part) => part.key === 'back')!
  const seat = parts.find((part) => part.key === 'seat')!

  expect(back.kind).toBe('band')
  expect(seat.y).toBeGreaterThan(back.y)
})

test('a chair has legs, and they belong to the model alone', () => {
  const legs = chairParts().filter((part) => part.key.startsWith('leg-'))

  expect(legs).toHaveLength(4)
  for (const leg of legs) {
    expect(leg.show).toBe('model')
    expect(leg.base).toBe(0)
  }
})

test('the legs stand under the seat, not beside it', () => {
  const parts = chairParts()
  const seat = parts.find((part) => part.key === 'seat')!
  const legs = parts.filter((part) => part.key.startsWith('leg-'))

  for (const leg of legs) {
    expect(Math.abs(leg.x - seat.x)).toBeLessThan(seat.width / 2)
    expect(Math.abs(leg.y - seat.y)).toBeLessThan(seat.depth / 2)
    expect(leg.height).toBe(seat.base)
  }
})

test('the back bows only a little, or it comes out a barrel', () => {
  const back = chairParts().find((part) => part.key === 'back')!

  expect(back.depth).toBeLessThan(back.width / 2)
})

test('the seat is where a seat is, and the back rises from it', () => {
  const parts = chairParts()
  const back = parts.find((part) => part.key === 'back')!
  const seat = parts.find((part) => part.key === 'seat')!

  expect(seat.base).toBeGreaterThan(400)
  expect(back.base).toBeGreaterThanOrEqual(seat.base + seat.height)
  expect(back.base + back.height).toBeGreaterThan(850)
})

test('a table top stands at table height on legs that reach it', () => {
  const parts = skeletonOf(thing())
  const top = parts.find((part) => part.key === 'top')!
  const leg = parts.find((part) => part.key === 'leg-0')!

  expect(top.base).toBe(leg.height)
})

test('a table sets out as many chairs as it has places', () => {
  const parts = skeletonOf(thing())
  const chairs = new Set(
    parts.filter((part) => part.key.startsWith('chair-')).map((part) => part.key.split('-')[1]),
  )

  expect(chairs.size).toBe(6)
})

test('the top is drawn over the chairs, so they read as tucked under it', () => {
  const parts = skeletonOf(thing())
  const top = parts.find((part) => part.key === 'top')!

  for (const part of parts.filter((entry) => entry.key.startsWith('chair-'))) {
    expect(top.lift).toBeGreaterThan(part.lift)
  }
})

test('chairs stand round the table, not on top of it', () => {
  const parts = skeletonOf(thing()).filter((part) => part.key.endsWith('seat'))

  for (const seat of parts) {
    const clear = Math.abs(seat.x) > 1600 / 2 || Math.abs(seat.y) > 900 / 2
    expect(clear, seat.key).toBe(true)
  }
})

test('a four-place table seats one at each end and one along each side', () => {
  const parts = skeletonOf(thing({ seats: 4 })).filter((part) => part.key.endsWith('-back'))
  const across = parts.filter((part) => Math.abs(part.x) > Math.abs(part.y))

  expect(parts).toHaveLength(4)
  expect(across).toHaveLength(2)
})

test('a type with no skeleton yet still draws its footprint', () => {
  const parts = skeletonOf(thing({ type: 'piano' }))

  expect(parts.map((part) => part.key)).toEqual(['body'])
})

test('the chairs round a table are a shade darker than its top', () => {
  const parts = skeletonOf(thing())
  const top = parts.find((part) => part.key === 'top')!
  const seats = parts.filter((part) => part.key.endsWith('-seat'))

  expect(top.tone ?? 'plain').toBe('plain')
  expect(seats.length).toBeGreaterThan(0)
  for (const seat of seats) expect(seat.tone).toBe('dark')
})

test('a chair standing on its own is not shaded: there is nothing to stand out against', () => {
  const parts = skeletonOf(thing({ type: 'chair', width: 460, depth: 500, seats: undefined }))

  for (const part of parts) expect(part.tone ?? 'plain').toBe('plain')
})

const plantParts = (id = 'f1') =>
  skeletonOf(thing({ id, type: 'plant', width: 700, depth: 700, seats: undefined }))

test('a plant throws its leaves out from the pot', () => {
  const parts = plantParts()
  const pot = parts.find((part) => part.key === 'pot')!
  const leaves = parts.filter((part) => part.key.startsWith('leaf-'))

  expect(leaves.length).toBeGreaterThanOrEqual(6)
  for (const leaf of leaves) {
    expect(Math.hypot(leaf.x, leaf.y)).toBeGreaterThan(0)
    expect(leaf.depth).toBeGreaterThan(leaf.width)
  }
  expect(pot.tone).toBe('dark')
})

test('the leaves go all the way round, not to one side', () => {
  const leaves = plantParts().filter((part) => part.key.startsWith('leaf-'))
  const middle = leaves.reduce((sum, leaf) => ({ x: sum.x + leaf.x, y: sum.y + leaf.y }), {
    x: 0,
    y: 0,
  })

  expect(Math.hypot(middle.x, middle.y)).toBeLessThan(700 * 0.15)
})

test('no two leaves are the same length, or it reads as a logo', () => {
  const leaves = plantParts().filter((part) => part.key.startsWith('leaf-'))

  expect(new Set(leaves.map((leaf) => leaf.depth)).size).toBe(leaves.length)
})

test('two plants in a room are not the same plant', () => {
  const one = plantParts('f1').filter((part) => part.key.startsWith('leaf-'))
  const other = plantParts('f2').filter((part) => part.key.startsWith('leaf-'))

  expect(one.map((leaf) => leaf.depth)).not.toEqual(other.map((leaf) => leaf.depth))
})

test('a plant keeps its own shape rather than shuffling on every draw', () => {
  expect(plantParts('f7')).toEqual(plantParts('f7'))
})

test('every type in the catalogue has a skeleton of its own', () => {
  for (const entry of OBJECT_TYPES) {
    const parts = skeletonOf(
      thing({
        type: entry.id,
        width: entry.size.width,
        depth: entry.size.depth,
        surface: entry.surfaces[0]!,
        ...(entry.seats ? { seats: entry.seats } : {}),
      }),
    )
    // A type with no skeleton falls back to its bare footprint, which is one part.
    expect(
      parts.map((part) => part.key),
      entry.id,
    ).not.toEqual(['body'])
  }
})

const rugParts = () =>
  skeletonOf(thing({ type: 'rug', width: 2400, depth: 1700, surface: 'blue', seats: undefined }))

test('a rug is a field with its fringe at two opposite ends', () => {
  const parts = rugParts()
  const field = parts.find((part) => part.key === 'field')!
  const fringe = parts.filter((part) => part.key.startsWith('fringe-'))

  expect(field.width).toBe(2400)
  // Wider than it is deep, so the ends it was woven from are the east and west.
  expect(new Set(fringe.map((part) => Math.sign(part.x)))).toEqual(new Set([1, -1]))
  expect(fringe.length).toBeGreaterThan(6)
})

test('the fringe hangs off the short ends, whichever way the rug lies', () => {
  const wide = rugParts().filter((part) => part.key.startsWith('fringe-'))
  const tall = skeletonOf(
    thing({ type: 'rug', width: 900, depth: 2000, surface: 'blue', seats: undefined }),
  ).filter((part) => part.key.startsWith('fringe-'))

  for (const strand of wide) expect(Math.abs(strand.x)).toBeGreaterThan(2400 / 2)
  for (const strand of tall) expect(Math.abs(strand.y)).toBeGreaterThan(2000 / 2)
})

test('the fringe reaches both corners of the end it hangs from', () => {
  const strands = rugParts().filter((part) => part.key.startsWith('fringe-1-'))
  const along = strands.map((part) => part.y)
  const across = strands[0]!.width

  expect(Math.min(...along) - across / 2).toBe(-1700 / 2)
  expect(Math.max(...along) + across / 2).toBe(1700 / 2)
})

test('a rug lies under everything else, or the table ends up beneath the carpet', () => {
  const rug = rugParts().find((part) => part.key === 'field')!
  const table = skeletonOf(thing()).find((part) => part.key === 'top')!
  const chair = skeletonOf(thing()).find((part) => part.key.endsWith('-seat'))!

  expect(rug.lift).toBeLessThan(chair.lift)
  expect(rug.lift).toBeLessThan(table.lift)
})

const roundParts = (seats = 4) =>
  skeletonOf(thing({ type: 'table-round', width: 1200, depth: 1200, seats }))

test('a round table seats its chairs round the circle, not along a side', () => {
  const backs = roundParts(5).filter((part) => part.key.endsWith('-back'))
  const reach = backs.map((part) => Math.hypot(part.x, part.y))

  expect(backs).toHaveLength(5)
  for (const one of reach) expect(one).toBeCloseTo(reach[0]!, -1)
})

test('the chairs face the middle of a round table, not away from it', () => {
  for (const seat of roundParts().filter((part) => part.key.endsWith('-seat'))) {
    // The seat sits in front of the chair's own middle, so it is nearer the table.
    const back = roundParts().find((part) => part.key === seat.key.replace('-seat', '-back'))!
    expect(Math.hypot(seat.x, seat.y)).toBeLessThan(Math.hypot(back.x, back.y))
  }
})

test('a round table stands on one foot, and only the model sees it', () => {
  const stem = roundParts().find((part) => part.key === 'stem')!
  const top = roundParts().find((part) => part.key === 'top')!

  expect(stem.show).toBe('model')
  expect(stem.base + stem.height).toBe(top.base)
  expect(top.kind).toBe('disc')
})

test('a bedside table shows the line of its drawer, and only in the plan', () => {
  const parts = skeletonOf(thing({ type: 'bedside', width: 460, depth: 400, seats: undefined }))
  const drawer = parts.find((part) => part.key === 'drawer')!
  const top = parts.find((part) => part.key === 'top')!

  expect(drawer.show).toBe('plan')
  expect(drawer.paint).toBe('line')
  expect(drawer.width).toBeLessThan(top.width)
})

const sofaParts = (seats = 3) =>
  skeletonOf(thing({ type: 'sofa', width: 2100, depth: 900, surface: 'blue', seats }))

test('a sofa has a cushion for every place it seats', () => {
  expect(sofaParts(2).filter((part) => part.key.startsWith('cushion-'))).toHaveLength(2)
  expect(sofaParts(4).filter((part) => part.key.startsWith('cushion-'))).toHaveLength(4)
})

test('the arms and back are whole pills; the seat is not', () => {
  const parts = sofaParts()
  const rounded = (key: string) => parts.find((part) => part.key === key)!

  for (const key of ['arm-west', 'arm-east', 'back']) {
    const part = rounded(key)
    expect(part.radius, key).toBe(Math.min(part.width, part.depth) / 2)
  }

  const seat = rounded('cushion-0')
  expect(seat.radius).toBeLessThan(Math.min(seat.width, seat.depth) / 2)
})

test('the cushions run into one another and under the arms', () => {
  const parts = sofaParts()
  const west = parts.find((entry) => entry.key === 'arm-west')!
  const cushions = parts.filter((entry) => entry.key.startsWith('cushion-'))

  // Overlapping, not merely touching: a gap between pills reads as a row of blocks.
  expect(cushions[0]!.x - cushions[0]!.width / 2).toBeLessThan(west.x + west.width / 2)
  for (let i = 1; i < cushions.length; i += 1) {
    const left = cushions[i - 1]!
    const right = cushions[i]!
    expect(right.x - right.width / 2).toBeLessThan(left.x + left.width / 2)
  }
})

test('the cushions run back under the back, and no further forward than the sofa', () => {
  const parts = sofaParts()
  const back = parts.find((part) => part.key === 'back')!
  const cushion = parts.find((part) => part.key === 'cushion-0')!

  expect(cushion.y - cushion.depth / 2).toBeLessThan(back.y + back.depth / 2)
  expect(cushion.y + cushion.depth / 2).toBe(900 / 2)
})

test('the seat goes down first and the frame closes over it', () => {
  const parts = sofaParts()
  const back = parts.find((part) => part.key === 'back')!
  const west = parts.find((part) => part.key === 'arm-west')!
  const cushions = parts.filter((part) => part.key.startsWith('cushion-'))

  expect(back.width).toBe(2100)
  for (const cushion of cushions) {
    expect(west.lift, cushion.key).toBeGreaterThan(cushion.lift)
    expect(back.lift, cushion.key).toBeGreaterThan(cushion.lift)
  }
  expect(back.lift).toBeGreaterThan(west.lift)
})

test('every cushion is drawn over the one before it, so the seam between them shows', () => {
  const cushions = sofaParts(4).filter((part) => part.key.startsWith('cushion-'))

  for (let i = 1; i < cushions.length; i += 1) {
    expect(cushions[i]!.lift, cushions[i]!.key).toBeGreaterThan(cushions[i - 1]!.lift)
  }
})

test('the back and arms are a shade darker, and the thrown cushion a shade lighter', () => {
  const parts = sofaParts()

  expect(parts.find((part) => part.key === 'back')!.tone).toBe('dark')
  expect(parts.find((part) => part.key === 'arm-west')!.tone).toBe('dark')
  expect(parts.find((part) => part.key === 'cushion-0')!.tone ?? 'plain').toBe('plain')
  expect(parts.find((part) => part.key === 'pillow')!.tone).toBe('light')
})

test('a sofa is drawn at seat height, with its back rising above it', () => {
  const parts = sofaParts()
  const back = parts.find((part) => part.key === 'back')!
  const cushion = parts.find((part) => part.key === 'cushion-0')!

  expect(back.base + back.height).toBeGreaterThan(cushion.base + cushion.height)
})

const consoleParts = (width = 1600) =>
  skeletonOf(thing({ type: 'tv-stand', width, depth: 420, surface: 'black', seats: undefined }))

test('a console is a top with a handle for every door under it', () => {
  const drawn = consoleParts().filter((part) => (part.show ?? 'both') !== 'model')
  const top = drawn.find((part) => part.key === 'top')!
  const handles = drawn.filter((part) => part.key.startsWith('handle-'))

  expect(top.kind).toBe('rect')
  expect(top.width).toBe(1600)
  // The same handles as a kitchen run: standing off the front edge, one to a door,
  // halfway along it. A line drawn across the top instead reads as a scratch.
  expect(handles).toHaveLength(2)
  expect(drawn).toHaveLength(1 + handles.length)
  for (const handle of handles) {
    expect(handle.y + handle.depth / 2).toBeGreaterThan(top.y + top.depth / 2)
  }
})

test('a console has wider doors than a kitchen unit, being a longer, lower thing', () => {
  const doors = consoleParts(2400).filter((part) => part.key.startsWith('handle-')).length
  const units = cabinetParts(2400).filter((part) => part.key.startsWith('handle-')).length

  expect(doors).toBeLessThan(units)
})

const tvParts = () =>
  skeletonOf(thing({ type: 'tv', width: 1250, depth: 220, surface: 'black', seats: undefined }))

test('a television is a thin display with the electronics behind it', () => {
  const parts = tvParts()
  const display = parts.find((part) => part.key === 'display')!
  const housing = parts.find((part) => part.key === 'housing')!

  expect(display.width).toBe(1250)
  expect(display.depth).toBeLessThan(display.width / 8)
  // Behind the display, narrower than it, and cornered off so it is not a rectangle.
  expect(housing.y).toBeLessThan(display.y)
  expect(housing.width).toBeLessThan(display.width)
  expect(housing.bevel).toBe(true)
  // Square where it meets the display and cut off only at the back, so the two
  // lie against one another instead of leaving a pill-shaped gap between them.
  expect(housing.radius).toEqual({ bl: 46, br: 46 })
  expect(housing.y + housing.depth / 2).toBe(display.y)
  expect(housing.tone ?? 'plain').toBe('plain')
})

test('it stands on a little cross, centred on the display', () => {
  const parts = tvParts()
  const across = parts.find((part) => part.key === 'foot-across')!
  const along = parts.find((part) => part.key === 'foot-along')!
  const display = parts.find((part) => part.key === 'display')!
  const housing = parts.find((part) => part.key === 'housing')!

  // Two bars over the same point, one each way: a cross, not a block.
  expect(across.x).toBe(along.x)
  expect(across.y).toBe(along.y)
  expect(across.width).toBeGreaterThan(across.depth)
  expect(along.depth).toBeGreaterThan(along.width)
  // Turned onto its corner, so the legs come out diagonally rather than lying
  // along the display and disappearing under it.
  expect(across.turn).toBeCloseTo(Math.PI / 4)
  expect(along.turn).toBeCloseTo(Math.PI / 4)
  // The same middle as the display seen from above, and drawn under everything —
  // all that shows of it is the tips of the legs.
  expect(across.x).toBe(display.x)
  expect(across.y).toBe(display.y)
  expect(display.lift).toBeGreaterThan(across.lift)
  expect(housing.lift).toBeGreaterThan(across.lift)
})

test('a television is a display, not a box: it stands well above the floor', () => {
  const display = tvParts().find((part) => part.key === 'display')!

  expect(display.base).toBeGreaterThan(400)
})

test('the console is a shade lighter, so the black television on it reads', () => {
  const top = consoleParts().find((part) => part.key === 'top')!
  const display = tvParts().find((part) => part.key === 'display')!

  expect(top.tone).toBe('light')
  expect(display.tone ?? 'plain').toBe('plain')
})

test('a bigger television is a wider display, not a deeper one', () => {
  const wide = skeletonOf(
    thing({ type: 'tv-large', width: 1700, depth: 240, surface: 'black', seats: undefined }),
  ).find((part) => part.key === 'display')!
  const small = tvParts().find((part) => part.key === 'display')!

  expect(wide.width).toBeGreaterThan(small.width)
  expect(wide.depth).toBe(small.depth)
})

const toiletParts = () =>
  skeletonOf(thing({ type: 'toilet', width: 380, depth: 700, surface: 'white', seats: undefined }))

test('a toilet is an egg with the cistern behind it', () => {
  const parts = toiletParts()
  const bowl = parts.find((part) => part.key === 'bowl')!
  const cistern = parts.find((part) => part.key === 'cistern')!

  // Backed onto the wall, the bowl reaching out into the room in front of it.
  expect(cistern.y).toBeLessThan(bowl.y)
  expect(cistern.y - cistern.depth / 2).toBe(-700 / 2)
  expect(bowl.y + bowl.depth / 2).toBe(700 / 2)
  // The bowl runs back under the cistern and the cistern is drawn over it, so the
  // two read as one fitting rather than as two shapes with their edges touching.
  expect(bowl.y - bowl.depth / 2).toBeLessThan(cistern.y + cistern.depth / 2)
  expect(cistern.lift).toBeGreaterThan(bowl.lift)
  // An egg, not an ellipse and not a box: a half-circle at the front, and squarer
  // at the back where it meets the cistern.
  const corner = bowl.radius as Required<Corners>
  expect(corner.fl).toBe(bowl.width / 2)
  expect(corner.fr).toBe(bowl.width / 2)
  expect(corner.bl).toBe(corner.br)
  expect(corner.bl).toBeLessThan(corner.fl * 0.7)
})

test('the cistern has the flush button on it', () => {
  const parts = toiletParts()
  const cistern = parts.find((part) => part.key === 'cistern')!
  const button = parts.find((part) => part.key === 'button')!

  expect(button.width).toBeLessThan(cistern.width / 2)
  expect(button.depth).toBeLessThan(cistern.depth)
  expect(button.lift).toBeGreaterThan(cistern.lift)
  // Darker, or a white button on a white cistern is no button at all.
  expect(button.tone).toBe('dark')
})

test('the seat shows as a ring inside the bowl', () => {
  const parts = toiletParts()
  const bowl = parts.find((part) => part.key === 'bowl')!
  const seat = parts.find((part) => part.key === 'seat')!

  // Filled in the bowl's own colour and drawn over it, so all that separates the
  // two is the edge every part carries. Painted as a line it comes out a solid
  // blob, which is a lid, not a seat.
  expect(seat.paint ?? 'fill').toBe('fill')
  expect(seat.width).toBeLessThan(bowl.width)
  expect(seat.depth).toBeLessThan(bowl.depth)
  expect(seat.lift).toBeGreaterThan(bowl.lift)
})

test('a bin is a round black tub', () => {
  const parts = skeletonOf(
    thing({ type: 'bin', width: 300, depth: 300, surface: 'black', seats: undefined }),
  )
  const body = parts.find((part) => part.key === 'body')!
  const mouth = parts.find((part) => part.key === 'mouth')!

  expect(body.kind).toBe('disc')
  // Lifted off the black it is made of: a bin drawn in flat black is a hole in
  // the floor, and next to it the mouth still has to read.
  expect(body.tone).toBe('light')
  expect(mouth.kind).toBe('disc')
  expect(mouth.width).toBeLessThan(body.width)
  expect(mouth.lift).toBeGreaterThan(body.lift)
  expect(mouth.tone).toBe(body.tone)
})

const rollParts = () =>
  skeletonOf(
    thing({ type: 'toilet-roll', width: 260, depth: 180, surface: 'white', seats: undefined }),
  )

test('a toilet roll lies on its side, because that is how it hangs', () => {
  const parts = rollParts()
  const roll = parts.find((part) => part.key === 'roll')!

  // Seen from straight above, a roll on a holder shows its side, not its end: it
  // is a cylinder lying along the wall, so it draws as a rectangle. A circle here
  // is a roll standing on the floor.
  expect(roll.kind).toBe('rect')
  expect(roll.width).toBeGreaterThan(roll.depth)
})

test('it hangs off a plate on the wall, on two arms', () => {
  const parts = rollParts()
  const plate = parts.find((part) => part.key === 'plate')!
  const roll = parts.find((part) => part.key === 'roll')!
  const arms = parts.filter((part) => part.key.startsWith('arm-'))

  // The plate flat against the wall, the roll out in front of it.
  expect(plate.y).toBeLessThan(roll.y)
  expect(plate.y - plate.depth / 2).toBe(-180 / 2)
  // An arm at each end, drawn as a line and clear of the roll between them.
  expect(arms).toHaveLength(2)
  expect(arms.every((arm) => arm.paint === 'line')).toBe(true)
  expect(Math.abs(arms[0]!.x)).toBeGreaterThan(roll.width / 2)
  expect(arms[0]!.x).toBe(-arms[1]!.x)
})

test('the roll turns on a rod, drawn through it from one arm to the other', () => {
  const parts = rollParts()
  const rod = parts.find((part) => part.key === 'rod')!
  const roll = parts.find((part) => part.key === 'roll')!
  const arms = parts.filter((part) => part.key.startsWith('arm-'))

  expect(rod.paint).toBe('line')
  expect(rod.y).toBe(roll.y)
  // Reaching both arms, and under the roll: the paper is wound over the rod, so
  // what shows of it is the two stubs between the roll and the arms holding it.
  expect(rod.width / 2).toBeGreaterThanOrEqual(Math.abs(arms[0]!.x))
  expect(rod.width).toBeGreaterThan(roll.width)
  expect(roll.lift).toBeGreaterThan(rod.lift)
})

const basinParts = () =>
  skeletonOf(thing({ type: 'basin', width: 600, depth: 450, surface: 'white', seats: undefined }))

const vanityParts = () =>
  skeletonOf(thing({ type: 'vanity', width: 900, depth: 500, surface: 'walnut', seats: undefined }))

test('a basin is a bowl sunk in it, with the tap behind', () => {
  const parts = basinParts()
  const body = parts.find((part) => part.key === 'body')!
  const bowl = parts.find((part) => part.key === 'bowl')!
  const tap = parts.find((part) => part.key === 'tap')!

  expect(body.width).toBe(600)
  // The bowl inside the body and drawn over it, so what separates them is the edge
  // each one carries — the same way the seat shows inside a toilet.
  expect(bowl.width).toBeLessThan(body.width)
  expect(bowl.lift).toBeGreaterThan(body.lift)
  // A round knob at the back, clear of the bowl and between it and the wall.
  expect(tap.kind).toBe('disc')
  expect(tap.width).toBe(tap.depth)
  expect(tap.y + tap.depth / 2).toBeLessThanOrEqual(bowl.y - bowl.depth / 2)
})

test('a vanity is the same basin sunk in a cabinet top', () => {
  const parts = vanityParts()
  const top = parts.find((part) => part.key === 'top')!
  const bowl = parts.find((part) => part.key === 'bowl')!

  expect(top.width).toBe(900)
  expect(top.depth).toBe(500)
  expect(bowl.lift).toBeGreaterThan(top.lift)
  // Sunk in a top, not filling it: what says vanity rather than trough is the
  // counter left round the basin.
  expect(bowl.width).toBeLessThan(top.width / 2)
})

test('a vanity keeps its legs for the model and out of the plan', () => {
  const legs = vanityParts().filter((part) => part.key.includes('leg'))

  expect(legs.length).toBeGreaterThan(0)
  expect(legs.every((leg) => leg.show === 'model')).toBe(true)
})

test('the basin in a vanity is ceramic, whatever the cabinet is made of', () => {
  const sunk = vanityParts().find((part) => part.key === 'bowl')!
  const alone = basinParts().find((part) => part.key === 'bowl')!

  // Named, not coloured: what 'white' looks like is still `surfaces.ts` business.
  expect(sunk.surface).toBe('white')
  // A basin hung on its own is already made of the stuff its bowl is.
  expect(alone.surface).toBeUndefined()
})

const fridgeParts = () =>
  skeletonOf(thing({ type: 'fridge', width: 600, depth: 680, surface: 'steel', seats: undefined }))

test('a fridge is a box with its door across the front and a handle on it', () => {
  const parts = fridgeParts()
  const body = parts.find((part) => part.key === 'body')!
  const door = parts.find((part) => part.key === 'door')!
  const handle = parts.find((part) => part.key === 'handle')!

  expect(body.width).toBe(600)
  // The box stops short of the footprint: what fills the rest is the handle.
  expect(body.depth).toBeLessThan(680)
  // The door is the front of the box, drawn over it, and shallower than it.
  expect(door.depth).toBeLessThan(body.depth / 3)
  expect(door.y + door.depth / 2).toBe(body.y + body.depth / 2)
  expect(door.lift).toBeGreaterThan(body.lift)
  // The handle reaches out past the door, which is the only part of it a plan
  // seen from straight above could ever show.
  expect(handle.lift).toBeGreaterThan(door.lift)
  expect(Math.abs(handle.x)).toBeGreaterThan(body.width / 5)
  expect(handle.y + handle.depth / 2).toBeGreaterThan(body.y + body.depth / 2)
})

const cabinetParts = (width = 600) =>
  skeletonOf(thing({ type: 'cabinet', width, depth: 600, surface: 'marble', seats: undefined }))

test('a kitchen unit is a worktop with a handle standing off the front of it', () => {
  const parts = cabinetParts()
  const top = parts.find((part) => part.key === 'top')!
  const handle = parts.find((part) => part.key === 'handle-0')!

  expect(top.width).toBe(600)
  // A little bar, across rather than square, halfway along the door it opens.
  expect(handle.width).toBeGreaterThan(handle.depth * 2)
  expect(handle.width).toBeLessThan(top.width / 2)
  expect(handle.x).toBe(0)
  // Standing off the front edge, not lying on the top. Seen from straight above
  // the worktop covers the door and everything on it; what shows of a handle is
  // the part of it that reaches out past the worktop.
  expect(handle.y + handle.depth / 2).toBeGreaterThan(top.y + top.depth / 2)
  expect(handle.y - handle.depth / 2).toBeLessThan(top.y + top.depth / 2)
})

test('a longer run of units gets a door for every unit in it', () => {
  const doors = (width: number) =>
    cabinetParts(width).filter((part) => part.key.startsWith('handle-')).length

  expect(doors(600)).toBe(1)
  expect(doors(1800)).toBe(3)
})

test('every door in a run gets its handle in the middle of that door', () => {
  const handles = cabinetParts(1800).filter((part) => part.key.startsWith('handle-'))

  expect(handles.map((handle) => handle.x)).toEqual([-600, 0, 600])
})

const sinkParts = () =>
  skeletonOf(thing({ type: 'sink', width: 800, depth: 644, surface: 'marble', seats: undefined }))

test('a sink unit is a run of units with a bowl let into the top', () => {
  const parts = sinkParts()
  const top = parts.find((part) => part.key === 'top')!
  const bowl = parts.find((part) => part.key === 'bowl')!

  // Square-ish, where a basin is an egg: that is the difference between the two.
  expect(bowl.kind).toBe('rect')
  expect(bowl.width).toBeLessThan(top.width)
  expect(bowl.lift).toBeGreaterThan(top.lift)
  // Stainless whatever the worktop is made of, the way the basin in a walnut
  // vanity is ceramic.
  expect(bowl.surface).toBe('steel')
})

test('the tap over a sink is the same knob as over a basin', () => {
  const parts = sinkParts()
  const bowl = parts.find((part) => part.key === 'bowl')!
  const tap = parts.find((part) => part.key === 'tap')!

  expect(tap.kind).toBe('disc')
  expect(tap.width).toBe(tap.depth)
  expect(tap.y + tap.depth / 2).toBeLessThanOrEqual(bowl.y - bowl.depth / 2)
})

test('a sink unit still opens: it keeps the handles of the run it is', () => {
  expect(sinkParts().filter((part) => part.key.startsWith('handle-')).length).toBeGreaterThan(0)
})

const cookerParts = () =>
  skeletonOf(thing({ type: 'cooker', width: 600, depth: 700, surface: 'steel', seats: undefined }))

test('a cooker is four rings on a top, over an oven door', () => {
  const parts = cookerParts()
  const top = parts.find((part) => part.key === 'top')!
  const rings = parts.filter((part) => part.key.startsWith('ring-'))
  const oven = parts.find((part) => part.key === 'oven')!

  expect(rings).toHaveLength(4)
  expect(rings.every((ring) => ring.kind === 'disc')).toBe(true)
  expect(rings.every((ring) => ring.lift > top.lift)).toBe(true)
  // The oven door is the front of the thing, with its handle standing off it.
  expect(oven.y + oven.depth / 2).toBeLessThanOrEqual(top.y + top.depth / 2)
  expect(parts.find((part) => part.key === 'handle-0')).toBeDefined()
})

const stairParts = (type = 'stairs-up') =>
  skeletonOf(thing({ type, width: 3800, depth: 1000, surface: 'oak', seats: undefined }))
const treadsOf = (parts: ReturnType<typeof stairParts>) =>
  parts.filter((part) => part.key.startsWith('tread-'))

test('a flight of stairs is a run of treads across the whole of it', () => {
  const treads = treadsOf(stairParts())

  expect(treads.length).toBeGreaterThan(8)
  expect(Math.min(...treads.map((tread) => tread.x - tread.width / 2))).toBeCloseTo(-3800 / 2)
  expect(Math.max(...treads.map((tread) => tread.x + tread.width / 2))).toBeCloseTo(3800 / 2)
  // Every tread runs the full way across the flight, wall side to open side.
  for (const tread of treads) expect(tread.depth).toBe(1000)
})

test('each tread laps its neighbour, which is what a nosing is', () => {
  const [first, second] = treadsOf(stairParts())

  expect(second!.x - first!.x).toBeLessThan((first!.width + second!.width) / 2)
})

test('the plan draws the flight in one piece', () => {
  const parts = stairParts()
  const flight = parts.find((part) => part.key === 'flight')!

  // One surface, so the stone runs the length of the flight. Drawn a tread at a
  // time, a metre of marble is printed fifteen times over and reads as wallpaper.
  expect(flight.width).toBe(3800)
  expect(flight.depth).toBe(1000)
  // The treads are what the thing is and the model builds them; what the plan
  // shows is the top of the lot, with the steps marked across it.
  for (const tread of treadsOf(parts)) expect(tread.show).toBe('model')
})

test('a step is the riser under it, drawn as the wall it is', () => {
  const parts = stairParts()
  const risers = parts.filter((part) => part.key.startsWith('riser-'))
  const rail = parts.find((part) => part.key === 'rail')!
  const pitch = 3800 / (risers.length + 1)

  // One between each pair of treads. A flight of steps and a ladder lying on the
  // floor draw the same run of parallel lines; the riser standing under every
  // tread, in the shade of the nosing hanging over it, is what tells them apart.
  expect(risers).toHaveLength(treadsOf(parts).length - 1)
  for (const riser of risers) {
    expect(riser.tone).toBe('dark')
    // From the wall side to under the rail. A riser ends where the balustrade
    // stands on it, and one poking out past the rail reads as a grille.
    expect(riser.y - riser.depth / 2).toBe(-1000 / 2)
    const ends = riser.y + riser.depth / 2
    expect(ends).toBeGreaterThan(rail.y - rail.depth / 2)
    expect(ends).toBeLessThan(rail.y + rail.depth / 2)
    // Drawn the way a line is: no edge of its own to swallow it at this width, and
    // no shadow of its own to fringe the bottom of the flight with fifteen ticks.
    expect(riser.paint).toBe('line')
    // A line weight, near enough — heavy enough to read across a room, light
    // enough that fifteen of them are a flight of stairs and not a cattle grid.
    expect(riser.width).toBeGreaterThan(20)
    expect(riser.width).toBeLessThan(pitch / 2)
  }
})

test('a flight down hangs under the floor it is drawn on, and one up climbs off it', () => {
  const up = treadsOf(stairParts('stairs-up'))
  const down = treadsOf(stairParts('stairs-down'))

  // Real risers, so the model gets a staircase out of this rather than a ramp.
  expect(up[0]!.base).toBeGreaterThan(0)
  expect(up.at(-1)!.base).toBeGreaterThan(2000)
  // The flight down starts one riser under this floor and falls away from it.
  expect(down.at(-1)!.base).toBeLessThan(0)
  expect(down[0]!.base).toBeLessThan(-2000)
})

test('the low end is the same end of both flights', () => {
  // Up and down are one staircase seen from the two floors it joins. Which end of
  // it is the low one is a matter of the flight, not of which way you walk it.
  for (const type of ['stairs-up', 'stairs-down']) {
    const treads = treadsOf(stairParts(type))
    expect(treads.at(-1)!.base, type).toBeGreaterThan(treads[0]!.base)
  }
})

test('a flight that falls sinks into shadow, and one that climbs stands in the light', () => {
  const risersOf = (type: string) =>
    stairParts(type).filter((part) => part.key.startsWith('riser-'))
  const up = risersOf('stairs-up')
  const down = risersOf('stairs-down')

  // No arrow anywhere. Two flights seen from straight overhead have the very same
  // outline, and what tells them apart is the light: a stair going up stands on
  // this floor and is lit end to end, while one going down is a well, and the
  // further down it goes the less of the room's light reaches it.
  expect(stairParts().some((part) => part.key.startsWith('arrow'))).toBe(false)
  expect(new Set(up.map((part) => part.width)).size).toBe(1)
  // The marks run from the low end of the flight up, so the first is the deepest.
  expect(down[0]!.width).toBeGreaterThan(down.at(-1)!.width * 2)
  expect(down.at(-1)!.width).toBeGreaterThanOrEqual(up[0]!.width)
})

test('the handrail runs along the open side, over the steps', () => {
  const parts = stairParts()
  const rail = parts.find((part) => part.key === 'rail')!
  const flight = parts.find((part) => part.key === 'flight')!

  // On the room side. The other hand has the wall the flight backs onto.
  expect(rail.y).toBeGreaterThan(0)
  expect(rail.y + rail.depth / 2).toBeLessThanOrEqual(1000 / 2)
  expect(rail.width).toBeGreaterThan(rail.depth)
  expect(rail.lift).toBeGreaterThan(flight.lift)
  expect(rail.base).toBeGreaterThan(800)
})

const turnParts = (type = 'stairs-turn-up') =>
  skeletonOf(thing({ type, width: 3000, depth: 2150, surface: 'oak', seats: undefined }))

test('a staircase that turns is two flights with the wall standing between them', () => {
  const parts = turnParts()
  const flights = parts.filter((part) => part.key.startsWith('flight-'))
  const spine = parts.find((part) => part.key === 'spine')!
  const landing = parts.find((part) => part.key === 'landing')!

  expect(flights).toHaveLength(2)
  // One flight each side of the middle, with the wall in the gap between them.
  expect(Math.min(...flights.map((part) => part.y))).toBeLessThan(spine.y)
  expect(Math.max(...flights.map((part) => part.y))).toBeGreaterThan(spine.y)
  expect(spine.depth).toBeLessThan(flights[0]!.depth)
  // A wall is a wall, whatever the stair standing against it is made of.
  expect(spine.surface).toBe('black')
  // The landing lies across the end you turn on, the depth of the whole thing.
  expect(landing.depth).toBe(2150)
  expect(landing.x).toBeGreaterThan(flights[0]!.x)
  expect(landing.x + landing.width / 2).toBeCloseTo(3000 / 2)
})

test('the two flights climb one into the other, over the landing halfway up', () => {
  const parts = turnParts()
  const lower = parts.filter((part) => part.key.startsWith('tread-a-'))
  const upper = parts.filter((part) => part.key.startsWith('tread-b-'))
  const landing = parts.find((part) => part.key === 'landing')!

  expect(lower).toHaveLength(upper.length)
  // Up the first flight, across the landing, and up the second: the landing is
  // half a storey and the top of the second flight is the whole of one.
  expect(lower.at(-1)!.base).toBeLessThan(landing.base)
  expect(landing.base).toBeLessThan(upper.at(-1)!.base)
  expect(upper.at(-1)!.base).toBeGreaterThan(2000)
  // And the second flight climbs back the way the first one came.
  expect(lower.at(-1)!.x).toBeGreaterThan(lower[0]!.x)
  expect(upper.at(-1)!.x).toBeLessThan(upper[0]!.x)
})

test('a turning flight down hangs under this floor, like a straight one', () => {
  const parts = turnParts('stairs-turn-down')
  const top = parts.filter((part) => part.key.startsWith('tread-b-')).at(-1)!

  expect(top.base).toBeLessThan(0)
  expect(parts.find((part) => part.key === 'landing')!.base).toBeLessThan(top.base)
})

test('nor is there an arrow on the staircase that turns', () => {
  const parts = turnParts('stairs-turn-down')
  const risers = parts.filter((part) => part.key.startsWith('riser-'))

  expect(parts.some((part) => part.key.startsWith('arrow'))).toBe(false)
  // Deepest at the bottom of the first flight, and barely shaded at the top of
  // the second, which is where you step off this floor onto it.
  const deepest = risers.reduce((best, next) => (next.width > best.width ? next : best))
  const lightest = risers.reduce((best, next) => (next.width < best.width ? next : best))
  expect(deepest.base).toBeLessThan(lightest.base)
})

const bedParts = (type = 'bed', width = 1600) =>
  skeletonOf(thing({ type, width, depth: 2050, surface: 'linen', seats: undefined }))

test('a bed is the cover on it, with the pillows at the head against the wall', () => {
  const parts = bedParts()
  const duvet = parts.find((part) => part.key === 'duvet')!
  const pillows = parts.filter((part) => part.key.startsWith('pillow-'))
  const head = parts.find((part) => part.key === 'headboard')!

  // The head is the wall end, which is the end a bed is always put at.
  expect(head.y - head.depth / 2).toBe(-2050 / 2)
  for (const pillow of pillows) expect(pillow.y).toBeLessThan(duvet.y)
  // The cover is laid on the mattress rather than painted over the whole of it:
  // the foot of a made bed shows a hand's width of sheet. And no weave printed on
  // any of it — bedding is smooth, and a pattern at this size is noise.
  const mattress = parts.find((part) => part.key === 'mattress')!
  expect(duvet.y + duvet.depth / 2).toBeLessThan(mattress.y + mattress.depth / 2)
  expect(duvet.lift).toBeGreaterThan(mattress.lift)
  for (const pillow of pillows) expect(pillow.lift).toBeGreaterThan(duvet.lift)
  for (const part of parts) expect(part.plain ?? part.show === 'model').toBe(true)
})

test('a double bed is slept in by two and a single by one', () => {
  expect(bedParts('bed').filter((part) => part.key.startsWith('pillow-'))).toHaveLength(2)
  expect(bedParts('bed-single', 900).filter((part) => part.key.startsWith('pillow-'))).toHaveLength(
    1,
  )
})

test('the sheet is turned down under the pillows, which is what says which end is which', () => {
  const parts = bedParts()
  const turn = parts.find((part) => part.key === 'turn')!
  const duvet = parts.find((part) => part.key === 'duvet')!

  // A band of lighter linen across the head end of the cover. Without it a bed
  // seen from straight above is a rectangle with two lozenges on it.
  const pillow = parts.find((part) => part.key === 'pillow-0')!

  expect(turn.tone).toBe('light')
  expect(turn.y).toBeLessThan(duvet.y)
  expect(turn.width).toBe(duvet.width)
  // The cover tucks a little way under the pillows, but the fold has to show
  // below them: laid at the head it disappears beneath them altogether.
  const shows = turn.y + turn.depth / 2 - (pillow.y + pillow.depth / 2)
  expect(shows).toBeGreaterThan(100)
})

const bathParts = () =>
  skeletonOf(thing({ type: 'bath', width: 1700, depth: 750, surface: 'white', seats: undefined }))

test('a bath is a rim with the well sunk inside it and the tap at one end', () => {
  const parts = bathParts()
  const rim = parts.find((part) => part.key === 'rim')!
  const well = parts.find((part) => part.key === 'well')!
  const tap = parts.find((part) => part.key === 'tap')!

  // The rim shows all the way round the well, which is the band you sit on.
  expect(well.width).toBeLessThan(rim.width)
  expect(well.depth).toBeLessThan(rim.depth)
  expect(well.lift).toBeGreaterThan(rim.lift)
  // The tap stands on the rim at one short end, not out over the water.
  expect(Math.abs(tap.x)).toBeGreaterThan(well.width / 2)
  expect(tap.lift).toBeGreaterThan(well.lift)
})

test('the waste is at the tap end, which is the end a bath drains at', () => {
  const parts = bathParts()
  const waste = parts.find((part) => part.key === 'waste')!
  const tap = parts.find((part) => part.key === 'tap')!

  expect(waste.kind).toBe('disc')
  expect(Math.sign(waste.x)).toBe(Math.sign(tap.x))
  expect(Math.abs(waste.x)).toBeLessThan(Math.abs(tap.x))
})

const showerParts = () =>
  skeletonOf(thing({ type: 'shower', width: 900, depth: 900, surface: 'white', seats: undefined }))

test('a shower is a tray with the glass round it and the rose over it', () => {
  const parts = showerParts()
  const tray = parts.find((part) => part.key === 'tray')!
  const panes = parts.filter((part) => part.key.startsWith('screen-'))
  const rose = parts.find((part) => part.key === 'rose')!
  const waste = parts.find((part) => part.key === 'waste')!

  expect(tray.width).toBe(900)
  // A screen is glass whatever the tray is: the two are not the same material,
  // and from overhead the glass is most of what says this is a shower at all.
  expect(panes.length).toBeGreaterThan(1)
  for (const pane of panes) expect(pane.surface).toBe('glass')
  // The rose is over the tray at the wall end, and the waste in the middle of it.
  expect(rose.y).toBeLessThan(0)
  expect(rose.lift).toBeGreaterThan(tray.lift)
  expect(waste.x).toBe(0)
  expect(waste.y).toBe(0)
})

test('the way in is a gap in the glass, not a box nobody can get into', () => {
  const parts = showerParts()
  const front = parts.find((part) => part.key === 'screen-front')!
  const panes = parts.filter((part) => part.key.startsWith('screen-'))

  // Glass across part of the front only. The rest of it is how you step in, and
  // a shower drawn closed on all four sides is a drawing of a cupboard.
  expect(front.width).toBeLessThan(900 * 0.75)
  // Panels, not pills, and none of them hanging off the edge of the tray.
  for (const pane of panes) {
    expect(pane.radius).toBeLessThan(10)
    expect(Math.abs(pane.x) + pane.width / 2).toBeLessThanOrEqual(900 / 2)
    expect(Math.abs(pane.y) + pane.depth / 2).toBeLessThanOrEqual(900 / 2)
  }
  // And standing a hair inside the free edges, so the tray's own line still runs
  // round the outside of the glass instead of under the middle of it.
  expect(front.y + front.depth / 2).toBeLessThan(900 / 2)
  for (const side of panes.filter((pane) => pane.key !== 'screen-front')) {
    expect(Math.abs(side.x) + side.width / 2).toBeLessThan(900 / 2)
  }
})

test('the rose hangs off an arm, so it reads as being up there rather than underfoot', () => {
  const parts = showerParts()
  const rose = parts.find((part) => part.key === 'rose')!
  const arm = parts.find((part) => part.key === 'arm')!
  const waste = parts.find((part) => part.key === 'waste')!

  // Reaching out of the wall to the rose. Two bare circles on a square tray are
  // two drains; a circle on the end of an arm is plainly hanging over one.
  expect(arm.y - arm.depth / 2).toBe(-900 / 2)
  expect(arm.y + arm.depth / 2).toBeCloseTo(rose.y, 0)
  expect(rose.lift).toBeGreaterThan(arm.lift)
  // And bigger than the gully, so which is which never comes down to size alone.
  expect(rose.width).toBeGreaterThan(waste.width * 2)
})
