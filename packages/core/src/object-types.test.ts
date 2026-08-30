import { expect, test } from 'vitest'
import { OBJECT_TYPE_IDS, OBJECT_TYPES, objectType } from './object-types'
import { SURFACE_IDS, surfaceOf } from './surfaces'

test('every type can be found by the id the command surface offers', () => {
  for (const id of OBJECT_TYPE_IDS) {
    expect(objectType(id)?.id).toBe(id)
  }
})

test('every type is finished in surfaces that exist', () => {
  for (const entry of OBJECT_TYPES) {
    expect(entry.surfaces.length).toBeGreaterThan(0)
    for (const surface of entry.surfaces) {
      expect(SURFACE_IDS).toContain(surface)
    }
  }
})

test('a chair is never made of glass, a table can be', () => {
  expect(objectType('chair')?.surfaces).not.toContain('glass')
  expect(objectType('table')?.surfaces).toContain('glass')
})

test('a textured surface says how big one repeat of it is', () => {
  for (const id of SURFACE_IDS) {
    const surface = surfaceOf(id)!
    if (surface.texture) expect(surface.unit).toBeGreaterThan(0)
  }
})

test('a pattern says it is one, so it can be coloured rather than taken as-is', () => {
  for (const id of SURFACE_IDS) {
    const surface = surfaceOf(id)!
    if (surface.tint) expect(surface.texture).toBeDefined()
  }
})

test('one weave serves several colours, and each keeps its own', () => {
  const weaves = SURFACE_IDS.map((id) => surfaceOf(id)!).filter(
    (surface) => surface.texture === 'weave.png',
  )

  expect(weaves.length).toBeGreaterThan(2)
  expect(new Set(weaves.map((surface) => surface.fill)).size).toBe(weaves.length)
})

test('an unknown type is absent rather than a stand-in', () => {
  expect(objectType('piano')).toBeUndefined()
})

test('a television comes in black and nothing else yet', () => {
  for (const id of ['tv', 'tv-large']) {
    expect(objectType(id)?.surfaces, id).toEqual(['black'])
  }
})

test('the console under it is furniture, and dark wood unless told otherwise', () => {
  for (const id of ['tv-stand', 'tv-stand-small']) {
    expect(objectType(id)?.surfaces[0], id).toBe('walnut')
    expect(objectType(id)?.surfaces, id).toContain('marble')
  }
})

test('a television sits on top of the furniture rather than on the floor', () => {
  expect(objectType('tv')?.layer).toBe('over')
  expect(objectType('rug')?.layer).toBe('under')
  expect(objectType('table')?.layer).toBeUndefined()
})

test('a toilet is a bathroom fitting: white, and it backs onto a wall', () => {
  expect(objectType('toilet')?.surfaces[0]).toBe('white')
  expect(objectType('toilet')?.stands).toBe('wall')
})

test('a toilet roll takes its own piece of wall, beside the toilet and not on it', () => {
  expect(objectType('toilet-roll')?.stands).toBe('wall')
  expect(objectType('toilet-roll')?.layer).toBeUndefined()
})

test('a basin is sanitary ware, a vanity is the cabinet it sits on', () => {
  expect(objectType('basin')?.surfaces).toEqual(['white', 'black'])
  expect(objectType('vanity')?.surfaces).toContain('marble')
  expect(objectType('vanity')?.surfaces).toContain('walnut')
  // Both back onto a wall: a basin in the middle of a room has nothing to plumb to.
  expect(objectType('basin')?.stands).toBe('wall')
  expect(objectType('vanity')?.stands).toBe('wall')
})

test('a texture is laid small enough to show on the thing it is laid on', () => {
  // A 2.4 m repeat on a 1.2 m vanity top puts half a tile on it, and marble with
  // no vein in it is not marble. Furniture is smaller than a floor, so its
  // patterns have to be.
  for (const id of SURFACE_IDS) {
    const surface = surfaceOf(id)!
    if (surface.texture) expect(surface.unit, id).toBeLessThanOrEqual(1600)
  }
})

test('a fridge is steel unless told otherwise, and it backs onto a wall', () => {
  expect(objectType('fridge')?.surfaces[0]).toBe('steel')
  expect(objectType('fridge')?.stands).toBe('wall')
})

test('a bin goes against a wall, because that is where a bin goes', () => {
  expect(objectType('bin')?.stands).toBe('wall')
})

test('a fridge comes in more than one finish', () => {
  const fridge = objectType('fridge')!.surfaces

  expect(fridge).toContain('steel')
  expect(fridge).toContain('white')
  expect(fridge).toContain('graphite')
  expect(fridge).toContain('black')
})

test('a kitchen unit is finished like furniture, marble worktop included', () => {
  expect(objectType('cabinet')?.surfaces).toContain('marble')
  expect(objectType('cabinet')?.surfaces).toContain('walnut')
  expect(objectType('cabinet')?.stands).toBe('wall')
})

test('a sink unit is a kitchen unit, finished like one', () => {
  expect(objectType('sink')?.surfaces).toContain('marble')
  expect(objectType('sink')?.stands).toBe('wall')
})

test('a cooker is an appliance, and it stands a little proud of the units', () => {
  const cooker = objectType('cooker')!
  const unit = objectType('cabinet')!

  expect(cooker.surfaces).toContain('steel')
  expect(cooker.stands).toBe('wall')
  // Deeper than the run it stands in, so it can be told from the cupboards.
  expect(cooker.size.depth).toBeGreaterThan(unit.size.depth)
  expect(objectType('fridge')!.size.depth).toBeGreaterThan(unit.size.depth)
})

test('what forms a run says so, and what does not says nothing', () => {
  for (const id of ['cabinet', 'sink', 'cooker', 'fridge']) {
    expect(objectType(id)?.abuts, id).toBe(true)
  }
  expect(objectType('sofa')?.abuts).toBeUndefined()
})

test('a flight of stairs is finished in wood or in stone', () => {
  const stairs = objectType('stairs-up')!

  expect(stairs.surfaces).toContain('oak')
  expect(stairs.surfaces).toContain('walnut')
  expect(stairs.surfaces).toContain('marble')
  // Against a wall. A flight standing out in the middle of a room is a stage.
  expect(stairs.stands).toBe('wall')
})

test('the flight down is the same flight as the one up', () => {
  const up = objectType('stairs-up')!
  const down = objectType('stairs-down')!

  expect(down.size).toEqual(up.size)
  expect(down.surfaces).toEqual(up.surfaces)
  // A long run and a narrow one: that is what makes it a staircase and not a step.
  expect(up.size.width).toBeGreaterThan(up.size.depth * 2)
})

test('a staircase that turns back on itself is two flights and a landing', () => {
  const turn = objectType('stairs-turn-up')!
  const straight = objectType('stairs-up')!

  expect(turn.surfaces).toEqual(straight.surfaces)
  expect(turn.stands).toBe('wall')
  // Half the run of a straight flight, because it doubles back — and wide enough
  // for two flights side by side with the wall between them.
  expect(turn.size.width).toBeLessThan(straight.size.width)
  expect(turn.size.depth).toBeGreaterThan(straight.size.depth * 2)
  expect(objectType('stairs-turn-down')!.size).toEqual(turn.size)
})

test('a bed is bedding, and it stands against a wall like a bed does', () => {
  const double = objectType('bed')!

  expect(double.stands).toBe('wall')
  expect(double.surfaces).toContain('white')
  expect(double.surfaces).toContain('linen')
  // Longer than it is wide, whichever bed it is: you lie along it.
  expect(double.size.depth).toBeGreaterThan(double.size.width)
  expect(objectType('bed-single')!.size.width).toBeLessThan(double.size.width)
  expect(objectType('bed-single')!.size.depth).toBe(double.size.depth)
})

test('a bath is sanitary ware, and the shape a bath is', () => {
  const bath = objectType('bath')!

  expect(bath.stands).toBe('wall')
  expect(bath.surfaces).toContain('white')
  expect(bath.surfaces).toContain('black')
  // Long and narrow: you lie in it, and it goes along a wall like the tub it is.
  expect(bath.size.width).toBeGreaterThan(bath.size.depth * 2)
})

test('a shower is sanitary ware too, and square, because a tray is', () => {
  const shower = objectType('shower')!

  expect(shower.stands).toBe('wall')
  expect(shower.surfaces).toEqual(objectType('bath')!.surfaces)
  expect(shower.size.width).toBe(shower.size.depth)
})
