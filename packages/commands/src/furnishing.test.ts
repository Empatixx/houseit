import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'

const problems = (script: string) => askPlan(createEmptyDocument(), script).problems
const coded = (script: string, code: string) =>
  problems(script).filter((problem) => problem.code === code)

const BEDROOM = [
  'add-room --material natural-oak --shape rectangle --width 4m --depth 3.6m --name ložnice',
  'add-opening --kind door --room ložnice --side south',
  'add-opening --kind window --room ložnice --side north',
].join('\n')

test('a bedroom asks for a bed and somewhere for clothes', () => {
  expect(coded(BEDROOM, 'room.unfurnished')[0]?.message).toBe(
    'ložnice still needs a bed and somewhere for clothes',
  )
  const furnished = `${BEDROOM}
add-object --room ložnice --type queen-bed --against north
add-object --room ložnice --type wardrobe --against east`
  expect(coded(furnished, 'room.unfurnished')).toEqual([])
})

test('a double bed wants to be got into from both sides', () => {
  const corner = `${BEDROOM}
add-object --room ložnice --type queen-bed --against north --along 800
add-object --room ložnice --type wardrobe --against east`
  const [cramped] = coded(corner, 'object.no-room-to-use')
  expect(cramped?.message).toMatch(/queen bed .* 600 mm clear beside it to get in, and the wall/)
  const single = `${BEDROOM}
add-object --room ložnice --type twin-bed --against north --along 0.15
add-object --room ložnice --type wardrobe --against east`
  expect(coded(single, 'object.no-room-to-use')).toEqual([])
})

test('a wardrobe that opens into the bed is called out', () => {
  const script = `${BEDROOM}
add-object --room ložnice --type queen-bed --against north
add-object --room ložnice --type wardrobe --against south --along 0.8`
  const found = coded(script, 'object.no-room-to-use')
  expect(found.some((problem) => /wardrobe/.test(problem.message))).toBe(true)
})

test('a kitchenette needs its fridge, and the fridge belongs at the run', () => {
  const living = [
    'add-room --material natural-oak --shape rectangle --width 7m --depth 5m --name obývák',
    'add-opening --kind door --room obývák --side south',
    'add-object --room obývák --type sofa-3 --against south --along 0.7',
    'add-object --room obývák --type coffee-table',
    'add-object --room obývák --type kitchen-i --against north --along 0.3',
  ].join('\n')
  expect(coded(living, 'kitchen.incomplete')[0]?.message).toBe('obývák has no a fridge')
  expect(
    coded(
      `${living}\nadd-object --room obývák --type refrigerator --against east --along 0.2`,
      'kitchen.fridge-far',
    ),
  ).toHaveLength(1)
})

test('a household needs a table seating everybody who sleeps there', () => {
  const script = `${BEDROOM}
add-object --room ložnice --type queen-bed --against north`
  expect(coded(script, 'flat.table-short')[0]?.message).toMatch(
    /2 sleep here and the tables seat 0/,
  )
  expect(coded(script, 'flat.no-washer')).toHaveLength(1)
})

const LIVING = [
  'add-room --name dům --shape rectangle --width 9m --depth 6m --material natural-oak',
  'add-room --name obývák --from dům --side west --width 5m --material natural-oak --kind living',
  'add-opening --kind door --room obývák --side east',
  'add-object --room obývák --type media-unit --against north',
].join('\n')

test('a thing says what it faces, and a sofa turned to the wall is called out', () => {
  const right = askPlan(
    createEmptyDocument(),
    `${LIVING}\nadd-object --room obývák --type sofa-3 --against south`,
  )
  const sofa = right.rooms
    .find((room) => room.name === 'obývák')!
    .objects.find((object) => object.type === 'sofa-3')!
  expect(sofa.faces).toMatch(/^north, towards the media unit with tv f1 \d+ mm ahead$/)
  expect(right.problems.filter((p) => p.code === 'object.faces-wall')).toEqual([])
  const wrong = `${LIVING}\nadd-object --room obývák --type sofa-3 --against south --rotation 180`
  expect(coded(wrong, 'object.faces-wall')[0]?.message).toMatch(
    /3-seat sofa in obývák faces south into the wall 0 mm away/,
  )
})

test('a door says what is ahead on both sides, and one onto the stairs is called out', () => {
  const script = `${LIVING}\nadd-object --room dům --type stairs-straight --against west --along 0.5 --rotation 90`
  const door = askPlan(createEmptyDocument(), script)
    .rooms.find((room) => room.name === 'obývák')!
    .openings.find((opening) => opening.kind === 'door')!
  expect(door.ahead).toEqual([
    expect.stringMatching(/^in obývák: /),
    'in dům: the straight staircase f2 0 mm ahead',
  ])
  expect(coded(script, 'door.onto-stairs')).toHaveLength(1)
})

test('a thing is turned by saying what it should face', () => {
  const script = `${LIVING}\nadd-object --room obývák --type sofa-3 --against south --rotation 180`
  expect(coded(script, 'object.back-to-screen')).toHaveLength(1)
  const fixed = `${script}\nupdate-object --id f2 --facing f1`
  const sofa = askPlan(createEmptyDocument(), fixed)
    .rooms.find((room) => room.name === 'obývák')!
    .objects.find((object) => object.id === 'f2')!
  expect(sofa.faces).toMatch(/^north, towards the media unit with tv f1/)
  expect(coded(fixed, 'object.back-to-screen')).toEqual([])
  const compass = askPlan(
    createEmptyDocument(),
    `${LIVING}\nadd-object --room obývák --type club-chair --along 0.3 --across 0.5 --facing east`,
  )
    .rooms.find((room) => room.name === 'obývák')!
    .objects.find((object) => object.type === 'club-chair')!
  expect(compass.faces).toMatch(/^east, /)
})

test('a chair belongs at a desk or a table, facing it', () => {
  const study = [
    'add-room --material natural-oak --shape rectangle --width 3.4m --depth 3.2m --name pracovna',
    'add-opening --kind door --room pracovna --side south',
    'add-opening --kind window --room pracovna --side north',
    'add-object --room pracovna --type office-desk --against north',
  ].join('\n')
  const away = `${study}\nadd-object --room pracovna --type office-chair --along 0.5 --across 0.5 --facing south`
  expect(coded(away, 'object.chair-alone')[0]?.message).toMatch(
    /office chair f2 in pracovna is not at a desk or table: it faces south/,
  )
  expect(coded(`${away}\nupdate-object --id f2 --facing f1`, 'object.chair-alone')).toEqual([])
})
