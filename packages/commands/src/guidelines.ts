import { DISPOSITIONS, STANDARD } from '@houseit/core/dispositions'
import { ROOM_KINDS } from '@houseit/core/room-kinds'

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
    'entry, pantry, storage, walk-in, garage, terrace, stairs.',
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
    'IN 2026',
    '',
    'The amendment to 146/2024, carrying EU directive 2024/1275, asks for two',
    'bicycle spaces per flat whatever its size — about 2 m² a flat, where the',
    'old rule came to 0.4. Car parking went the other way: one space per 120 m²',
    'of floor, one per 240 for affordable housing. Pram rooms are no longer',
    'required at all.',
  ].join('\n')
}
