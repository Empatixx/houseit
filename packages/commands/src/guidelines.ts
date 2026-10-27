import { DISPOSITIONS, STANDARD } from '@houseit/core/dispositions'
import { ROOM_NEEDS, USE_SPACE } from '@houseit/core/furnishing'
import { ROOM_KINDS, roomKind } from '@houseit/core/room-kinds'
import { STAIR_KINDS, stairShape } from '@houseit/core/stairs'

const sizes = () =>
  DISPOSITIONS.map(
    (it) =>
      `  ${it.id.padEnd(5)} ${String(it.rooms)} habitable room${it.rooms === 1 ? ' ' : 's'} + ` +
      `${it.kitchen === 'kitchenette' ? 'a kitchenette in one of them' : 'a kitchen of its own'}`.padEnd(
        34,
      ) +
      `${it.area.from}-${it.area.to} m²  ${it.who}${it.source === 'stepped' ? ' (stepped, not measured)' : ''}`,
  ).join('\n')

const rooms = () =>
  ROOM_KINDS.filter((kind) => kind.minArea > 1 || kind.minWidth !== undefined)
    .map(
      (kind) =>
        `  ${kind.id.padEnd(11)} ${String(kind.minArea).padStart(4)} m²` +
        (kind.minWidth === undefined ? '' : `  ${kind.minWidth} mm across`) +
        (kind.needsWindow ? '  wants a window' : ''),
    )
    .join('\n')

const holds = () =>
  Object.entries(ROOM_NEEDS)
    .map(
      ([kind, needs]) =>
        `  ${(roomKind(kind)?.label ?? kind).padEnd(28)} ${needs.map((need) => need.what).join(', ')}`,
    )
    .join('\n')

const space = () =>
  USE_SPACE.map((it) => {
    const clear =
      it.front !== undefined
        ? `${it.front} mm in front`
        : `${it.sides} mm beside${it.bothSides ? ' (both sides of a double)' : ''}`
    return `  ${it.name.padEnd(28)} ${clear}, ${it.why}`
  }).join('\n')

const stairs = () =>
  STAIR_KINDS.map((kind) => {
    const at = (height: number) => {
      const { size } = stairShape(kind, height)
      return `${size.width} x ${size.depth}`
    }
    return `  stairs-${kind.padEnd(10)} ${at(2800).padEnd(12)} ${at(3000)}`
  }).join('\n')

export function guidelinesText(): string {
  return [
    'HOW A CZECH FLAT OR HOUSE IS PUT TOGETHER',
    '',
    'Read this before laying out a dwelling. It is what the commands are checked',
    'against, so a plan that follows it comes back with an empty problem list.',
    '',
    'THE NOTATION',
    '',
    'A dwelling is named by what it holds: the number in front of the plus is how',
    'many obytné místnosti — habitable rooms — it has, and what follows says where',
    'the kitchen is. "kk" is a kuchyňský kout, a kitchenette standing in one of',
    'those rooms; "1" is a kitchen shut behind its own door. So 3+kk is three',
    'habitable rooms with the kitchen in the living one, and 3+1 is three plus a',
    'separate kitchen — four rooms in all, and the larger flat of the two.',
    '',
    `A kitchen counts as a habitable room, and is written "+1", once it reaches`,
    `${STANDARD.kitchenAsRoom} m² with daylight, ventilation and heating. Below that it is a corner,`,
    'however it is fitted out. Never counted, at any size: bathroom, wc, hall,',
    'entry, pantry, storage, walk-in, garage, terrace, winter garden, stairs.',
    '',
    'OUTSIDE THE WALLS',
    '',
    'A terrace, a path and paving are rooms without walls: draw the paved lot as',
    'the floor outline first, then cut the house out of it with --thickness 300',
    'and the terrace, the path and the winter garden out of what is left. What a',
    'wall is follows from the rooms on its two sides — against a room of the',
    'house it stands, round a winter garden it is glass, and between outdoor',
    'surfaces it is only an edge. Outdoor surfaces may lie in the setbacks but',
    'not past the parcel; the winter garden counts as part of the house.',
    '',
    'WHAT EACH ONE COMES TO',
    '',
    sizes(),
    '',
    'The market moved: a family flat used to be 80-100 m² and the average new',
    'build is now about 60 m², with one- and two-room flats the bulk of what is',
    'built. Draw to the range, not past it — a 3+kk at 90 m² is a plan nobody',
    'is building in 2026.',
    '',
    'WHAT THE STANDARD ASKS',
    '',
    `ČSN 73 4301, and vyhláška 146/2024 Sb. since July 2024. A habitable room is`,
    `at least ${STANDARD.habitableRoom} m², or ${STANDARD.onlyRoom} m² when it is the only one in the flat and has`,
    'to hold everything. A living room grows with the dwelling: ' +
      `${STANDARD.livingRoom.small} m² in a flat of`,
    `one or two rooms, ${STANDARD.livingRoom.medium} in three or four, ${STANDARD.livingRoom.large} in five or more, and 21-24 with`,
    'a dining table in it. Ceilings are ' +
      `${STANDARD.ceiling.habitable} mm where somebody lives and ${STANDARD.ceiling.service} where they wash or pass through.`,
    '',
    'By room, what the plan checks:',
    '',
    rooms(),
    '',
    `A passage wants ${STANDARD.passage} mm clear, 1200 where anything stands along it, and every`,
    `door wants ${STANDARD.approach} mm of clear floor in front of it on both sides — that is the`,
    'width of a shoulder, and it is the rule a staircase or a worktop across a',
    `doorway breaks. From ${STANDARD.separateWcFrom} habitable rooms the wc wants a room of its own`,
    'rather than a corner of the bathroom.',
    '',
    'THE ORDER TO BUILD IN',
    '',
    '1. The outline, at the size the disposition calls for.',
    '2. The wet rooms first, together: bathroom, wc and utility share one stack,',
    '   so putting them back to back is what makes the plumbing possible. Give',
    "   them the plan's dark middle, since none of them needs a window.",
    '3. The habitable rooms next, along the facade, because they are the ones',
    '   that need daylight and the check will ask for it.',
    '4. Circulation last, out of what is left. A hall drawn first eats the plan;',
    '   a hall drawn last is only as big as it has to be.',
    '5. Doors, then windows, then furniture — in that order, so each door lands',
    '   where nothing is standing and the furniture fits round what is fixed.',
    '',
    'A room is cut out of a room, never placed beside one, so start from the',
    'whole floor and take pieces off it. Cutting settles the shared wall for',
    'free; placing two rooms side by side leaves two walls with a gap between.',
    '',
    'THE KITCHEN',
    '',
    'The work triangle — cold store, sink, hob — wants each leg between 1.2 and',
    '2.7 m and the three together no more than 8 m. Keep a run of worktop at',
    'least 900 mm wide between the sink and the hob, because that is where the',
    'work happens. An island needs a passage all round it, 1200 mm at least.',
    '',
    'WHAT EACH ROOM HOLDS',
    '',
    'A room is drawn to be lived in, so it is furnished, and the check says what',
    'is missing. Every room of these kinds wants at least:',
    '',
    holds(),
    '',
    'A bathroom wants a toilet too unless its storey has a wc. Across the dwelling',
    'the tables seat everybody who sleeps there (a double bed sleeps two), and a',
    'washing machine stands somewhere: the bathroom or a utility room.',
    '',
    'ROOM TO USE A THING',
    '',
    'A thing that touches nothing can still be useless: a wardrobe whose doors',
    'open into the bed, a toilet with its front against the bath. Each of these',
    'wants clear floor, and the check names what is in the way:',
    '',
    space(),
    '',
    'LAYING OUT EACH ROOM',
    '',
    'Kitchen run (linka). Choose it by the room, not by habit. A straight run (I)',
    'goes along the longest wall that has no door, and suits a kitchenette or a',
    'kitchen under 2.4 m across. An L takes two walls meeting in the corner',
    'furthest from the door, each leg at least 1.8 m. A U wants 2.4 m inside so',
    'that 1.2 m stays between its legs. An island only where 1.2 m goes all',
    'round it and a run stands behind. The fridge stands at one end of the run,',
    'never in the middle of it; the sink goes under the window when there is',
    'one, and the hob never does. In a kitchenette the run takes the wall the',
    'sofa does not look at, and the dining table stands between the run and the',
    'sitting part, so that it is both the end of one and the edge of the other.',
    '',
    'Living room. The sofa faces the media unit 2-3 m away, the coffee table',
    'about 450 mm in front of the sofa, a rug under the group. Leave the way from',
    'the door to the window or the terrace open; nothing stands across it.',
    '',
    'Bedroom. The bed head goes against a wall with no window and not the one the',
    'door swings along, so you walk in beside the bed rather than into it. A',
    'double bed is got into from both sides, a single from one; nightstands at',
    "the head. The wardrobe takes a wall with 700 mm in front of it. A child's",
    'room is a single bed, a desk with its chair and a wardrobe.',
    '',
    'Bathroom and wc. The washbasin nearest the door, the bath or shower at the',
    'far end, the toilet beside the basin rather than facing the door. The',
    'washing machine stands in the bathroom or the utility room with 800 mm',
    'clear in front to load it.',
    '',
    'Entry and hall. Coats where you come in: a wardrobe or a coat stand and a',
    'bench beside the front door. Along a hall that is a passage, keep 900 mm.',
    '',
    'Office. The desk faces a wall or the window side, with 800 mm behind it',
    'for the chair.',
    '',
    'STOREYS AND STAIRS',
    '',
    'A storey of 2800 mm leaves 2550 mm clear under a 250 mm slab, short of the',
    '2600 a habitable room wants, so a house takes `update-level --height 3m` on',
    'every storey before its rooms are drawn. A flight is sized by the storey it',
    'climbs; its footprint in mm (width x depth) at 2800 and at 3000:',
    '',
    stairs(),
    '',
    'Measure the hall against that before drawing it: a straight flight wants a',
    'hall 1.2 m wide and 4.5 m long beside it, an L or U a squarer one. Turn a',
    'flight with --rotation 90 to lay it along a side. Upstairs, the flight cuts',
    'its own well, and the room it comes up into is the upper hall: draw that',
    'hall over the well with a metre of landing round it.',
    '',
    'THE GARDEN',
    '',
    'The plot is a lawn room drawn first, the house cut out of it. Trees stand in',
    'it as catalogue things: a broad deciduous tree or two to the south, at least',
    'their own height off the living room so the winter sun still reaches it, a',
    'spruce or a hedge along the north and the street as a screen, shrubs near the',
    'house to soften its foot. Then the fence: add-fence --around parcel follows',
    'the cadastral parcel, --around 6m runs a rectangle off the house, and its gate',
    'comes opposite the front door by itself.',
    '',
    'IN 2026',
    '',
    'The amendment to 146/2024, carrying EU directive 2024/1275, asks for two',
    'bicycle spaces per flat whatever its size — about 2 m² a flat, where the',
    'old rule came to 0.4. Car parking went the other way: one space per 120 m²',
    'of floor, one per 240 for affordable housing. Pram rooms are no longer',
    'required at all.',
  ].join('\n')
}
