import { modelFileOf } from '@houseit/core/imported'
import { Suspense } from 'react'
import { bathtub, shower, toilet, vanity, washerPair, washerStack } from './models/bathroom'
import {
  bed,
  bookshelf,
  clothingRack,
  coatStand,
  consoleMirror,
  credenza,
  crib,
  dresser,
  filing,
  mediaUnit,
  nightstand,
  plainBox,
} from './models/bedroom'
import { Brought } from './models/brought'
import { car } from './models/car'
import { bbq, column, floorLamp, pictureFrame, plant, railing, tableLamp } from './models/fittings'
import { exerciseBike, gymBench, treadmill, weightRack } from './models/gym'
import {
  dishwasher,
  fridge,
  hvac,
  island,
  kitchenI,
  kitchenL,
  kitchenSink,
  kitchenU,
  stove,
  waterHeater,
} from './models/kitchen'
import { bar, officeChair, officeDesk, officeDeskL, pingPong, poolTable } from './models/office'
import type { Builder, Part } from './models/parts'
import { bench, chairOttoman, dining, plainTable, sofa, sofaL } from './models/seating'
import { staircase } from './models/stairs'

const BUILDERS: Record<string, Builder> = {
  'cal-king-bed': bed,
  'king-bed': bed,
  'queen-bed': bed,
  'full-bed': bed,
  'twin-bed': bed,
  crib,
  nightstand,
  dresser,
  credenza,
  'filing-cabinet': filing,
  box: plainBox,
  'media-unit': mediaUnit,
  bookshelf,
  'built-in-shelf': bookshelf,
  'clothing-rack': clothingRack,
  'coat-stand': coatStand,
  'console-mirror': consoleMirror,
  'sofa-2': sofa,
  'sofa-3': sofa,
  'sofa-l': sofaL,
  'club-chair': sofa,
  'lounge-chair': sofa,
  'lounge-chair-s': sofa,
  'chair-ottoman': chairOttoman,
  bench,
  'gym-bench': gymBench,
  'coffee-table': plainTable,
  'side-table': plainTable,
  'outdoor-dining': dining(2, 1),
  'dining-round-4': dining(1, 1, true),
  'dining-square-4': dining(1, 1),
  'dining-6': dining(2, 1),
  'dining-8': dining(3, 1),
  'dining-square-8': dining(2, 2),
  'office-desk': officeDesk,
  'office-desk-l': officeDeskL,
  'office-chair': officeChair,
  'pool-table': poolTable,
  'ping-pong': pingPong,
  bar,
  'bar-island': island(false),
  'kitchen-i-mini': kitchenI(false),
  'kitchen-i': kitchenI(false),
  'kitchen-i-wall': kitchenI(true),
  'kitchen-i-mini-wall': kitchenI(true),
  'kitchen-l-mini': kitchenL(false),
  'kitchen-l': kitchenL(false),
  'kitchen-l-mini-wall': kitchenL(true),
  'kitchen-u': kitchenU(false),
  'kitchen-u-wall': kitchenU(true),
  'counter-straight': kitchenI(false),
  'counter-l': kitchenL(false),
  'kitchen-sink': kitchenSink,
  stove,
  refrigerator: fridge,
  dishwasher,
  'island-2': island(false),
  'island-4': island(false),
  'island-2-sink': island(true),
  'island-4-sink': island(true),
  'water-heater': waterHeater,
  hvac,
  'toilet-tank': toilet,
  'vanity-sink': vanity(1),
  'vanity-double': vanity(2),
  bathtub,
  'bathtub-free': bathtub,
  'shower-s': shower,
  'shower-m': shower,
  'shower-l': shower,
  'washer-dryer': washerPair,
  'washer-dryer-stacked': washerStack,
  'potted-plant': plant,
  'potted-plant-m': plant,
  'potted-plant-s': plant,
  'floor-lamp': floorLamp,
  'table-lamp': tableLamp,
  sedan: car(false),
  suv: car(true),
  'stairs-straight': staircase('straight'),
  'stairs-u': staircase('u'),
  'stairs-l-landing': staircase('l-landing'),
  'stairs-l-winder': staircase('l-winder'),
  'stairs-spiral': staircase('spiral'),
  column,
  post: column,
  railing,
  'picture-frame': pictureFrame,
  treadmill,
  'exercise-bike': exerciseBike,
  'weight-rack': weightRack,
  bbq,
}

export const modelled = (type: string): boolean =>
  type in BUILDERS || modelFileOf(type) !== undefined

export function Model({ type, part }: { type: string; part: Part }) {
  const file = modelFileOf(type)
  if (file) {
    return (
      <Suspense fallback={null}>
        <Brought file={file} part={part} />
      </Suspense>
    )
  }
  const build = BUILDERS[type]
  return build ? <>{build(part)}</> : null
}
