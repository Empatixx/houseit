import { flightWidthOf, type StairKind, stairShape, treadsOf } from '@houseit/core/stairs'
import type { ReactNode } from 'react'
import { MM } from '../plan-coordinates'
import { lighter, PAINT, type Paint } from './finish'

/**
 * The furniture, modelled: each type built up from slabs, drums and balls in
 * the thing's own frame — the floor under its middle at the origin, x across
 * it, y up, and +z its back, the side that goes against a wall — in millimetres,
 * the way the rest of the plan is said. A bed is a frame, a mattress, a duvet,
 * pillows and a headboard; a kitchen is runs of cabinets under a worktop with
 * handles along the front. Nothing here is a model from a file: what it costs
 * to add a thing is a few lines saying what it is made of.
 *
 * Built one at a time, and looked at — in the walk, from a couple of metres
 * off, the way `look.mjs` looks at a symbol from above.
 */

/** What a builder is handed: the thing's size and height, and its paints. */
export type Part = {
  w: number
  d: number
  h: number
  body: Paint
  frame: Paint
}

type Builder = (part: Part) => ReactNode

/** So many positions, each worked out from its number: what a row of things is keyed by. */
const along = (count: number, at: (i: number) => number): number[] =>
  Array.from({ length: count }, (_, i) => at(i))

// ---------------------------------------------------------------------------
// Primitives

function Finish({ paint }: { paint: Paint }) {
  return (
    <meshLambertMaterial
      color={paint.color}
      map={paint.map}
      transparent={paint.transparent}
      opacity={paint.opacity ?? 1}
      depthWrite={!paint.transparent}
    />
  )
}

type SlabProps = {
  x?: number
  z?: number
  /** Its underside above the thing's base. */
  base?: number
  w: number
  h: number
  d: number
  paint: Paint
  /** Turned about its own middle, in radians. */
  turn?: number
}

/** A box, said by where its underside is: the way a slab is put down on something. */
function Slab({ x = 0, z = 0, base = 0, w, h, d, paint, turn = 0 }: SlabProps) {
  return (
    <mesh position={[x * MM, (base + h / 2) * MM, z * MM]} rotation={[0, turn, 0]}>
      <boxGeometry args={[w * MM, h * MM, d * MM]} />
      <Finish paint={paint} />
    </mesh>
  )
}

type LeanProps = {
  x?: number
  /** Where its middle line starts and ends, as (z, y) in the thing's frame. */
  from: [number, number]
  to: [number, number]
  w: number
  thick: number
  paint: Paint
}

/** A slab leaning: said by the two points its middle line runs between. */
function Lean({ x = 0, from, to, w, thick, paint }: LeanProps) {
  const dz = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dz, dy)
  return (
    <mesh
      position={[x * MM, ((from[1] + to[1]) / 2) * MM, ((from[0] + to[0]) / 2) * MM]}
      rotation={[Math.atan2(dz, dy), 0, 0]}
    >
      <boxGeometry args={[w * MM, length * MM, thick * MM]} />
      <Finish paint={paint} />
    </mesh>
  )
}

type DrumProps = {
  x?: number
  z?: number
  base?: number
  r: number
  /** A different radius at the top makes a cone: a lampshade, a flowerpot. */
  top?: number
  h: number
  paint: Paint
  /** Longer one way than the other: an oval bowl. */
  stretch?: number
  open?: boolean
}

/** A cylinder standing on its end. */
function Drum({ x = 0, z = 0, base = 0, r, top, h, paint, stretch = 1, open = false }: DrumProps) {
  return (
    <mesh position={[x * MM, (base + h / 2) * MM, z * MM]} scale={[1, 1, stretch]}>
      <cylinderGeometry args={[(top ?? r) * MM, r * MM, h * MM, 28, 1, open]} />
      <Finish paint={paint} />
    </mesh>
  )
}

type DiscProps = {
  x?: number
  y: number
  z?: number
  r: number
  thick: number
  paint: Paint
  /** Which way its face points: out of the front, or out of the side. */
  facing?: 'front' | 'side'
}

/** A cylinder lying down, its face out: a wheel, a porthole. */
function Disc({ x = 0, y, z = 0, r, thick, paint, facing = 'front' }: DiscProps) {
  const rotation: [number, number, number] =
    facing === 'front' ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]
  return (
    <mesh position={[x * MM, y * MM, z * MM]} rotation={rotation}>
      <cylinderGeometry args={[r * MM, r * MM, thick * MM, 28]} />
      <Finish paint={paint} />
    </mesh>
  )
}

function Ball({
  x = 0,
  y,
  z = 0,
  r,
  paint,
}: {
  x?: number
  y: number
  z?: number
  r: number
  paint: Paint
}) {
  return (
    <mesh position={[x * MM, y * MM, z * MM]}>
      <sphereGeometry args={[r * MM, 18, 14]} />
      <Finish paint={paint} />
    </mesh>
  )
}

type LegsProps = {
  w: number
  d: number
  h: number
  inset?: number
  thick?: number
  paint: Paint
  x?: number
  z?: number
}

/** Four legs under the corners of a top. */
function Legs({ w, d, h, inset = 60, thick = 50, paint, x = 0, z = 0 }: LegsProps) {
  const dx = w / 2 - inset - thick / 2
  const dz = d / 2 - inset - thick / 2
  return (
    <>
      {[-dx, dx].map((lx) =>
        [-dz, dz].map((lz) => (
          <Slab key={`${lx}:${lz}`} x={x + lx} z={z + lz} h={h} w={thick} d={thick} paint={paint} />
        )),
      )}
    </>
  )
}

/** Something turned and put somewhere, in millimetres, with its own builder inside. */
function Put({
  x = 0,
  z = 0,
  turn = 0,
  children,
}: {
  x?: number
  z?: number
  turn?: number
  children: ReactNode
}) {
  return (
    <group position={[x * MM, 0, z * MM]} rotation={[0, turn, 0]}>
      {children}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Bedroom

const bed: Builder = ({ w, d, body, frame }) => {
  const two = w > 1200
  const pillowLine = d / 2 - 620
  return (
    <>
      <Legs w={w - 40} d={d - 40} h={100} thick={70} inset={0} paint={frame} />
      <Slab base={100} h={250} w={w} d={d} paint={frame} />
      <Slab base={350} h={200} w={w - 60} d={d - 60} paint={PAINT.porcelain} />
      <Slab
        base={550}
        h={50}
        w={w + 30}
        d={pillowLine + d / 2 - 40}
        z={(pillowLine - d / 2 + 40) / 2}
        paint={body}
      />
      <Slab base={600} h={60} w={w + 30} d={220} z={pillowLine - 110} paint={lighter(body, 0.12)} />
      {(two ? [-w / 4, w / 4] : [0]).map((x) => (
        <group key={x}>
          <Slab
            x={x}
            base={550}
            h={80}
            w={two ? w / 2 - 160 : w - 200}
            d={440}
            z={d / 2 - 330}
            paint={PAINT.porcelain}
          />
          <Slab
            x={x}
            base={630}
            h={70}
            w={two ? w / 2 - 220 : w - 260}
            d={400}
            z={d / 2 - 330}
            paint={PAINT.porcelain}
          />
        </group>
      ))}
      <Slab h={1050} w={w + 60} d={70} z={d / 2 - 35} paint={frame} />
      <Slab base={420} h={560} w={w - 20} d={30} z={d / 2 - 85} paint={lighter(body, 0.05)} />
    </>
  )
}

const crib: Builder = ({ w, d, body, frame }) => (
  <>
    <Legs w={w} d={d} h={900} inset={0} thick={40} paint={frame} />
    <Slab base={300} h={60} w={w} d={d} paint={frame} />
    <Slab base={360} h={140} w={w - 60} d={d - 60} paint={PAINT.porcelain} />
    <Slab base={500} h={30} w={w - 100} d={d - 300} z={-100} paint={body} />
    <Slab base={870} h={30} w={w} d={d} paint={frame} />
    {[-(d / 2 - 15), d / 2 - 15].flatMap((z) =>
      along(Math.floor((w - 80) / 90), (i) => -w / 2 + 85 + i * 90).map((x) => (
        <Slab key={`${x}:${z}`} x={x} z={z} base={360} h={510} w={16} d={16} paint={frame} />
      )),
    )}
    {[-(w / 2 - 15), w / 2 - 15].flatMap((x) =>
      along(Math.floor((d - 80) / 90), (i) => -d / 2 + 85 + i * 90).map((z) => (
        <Slab key={`${x}:${z}`} x={x} z={z} base={360} h={510} w={16} d={16} paint={frame} />
      )),
    )}
  </>
)

/** A cabinet: a plinth, a body, and handles on the front in columns and rows. */
function cabinet(part: Part, columns = 1, rows = 1, height = part.h): ReactNode {
  const { w, d, body, frame } = part
  const handles: ReactNode[] = []
  for (let c = 0; c < columns; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      handles.push(
        <Slab
          key={`${c}:${r}`}
          x={-w / 2 + ((c + 0.5) * w) / columns}
          z={-d / 2 - 10}
          base={60 + ((r + 0.5) * (height - 60)) / rows}
          h={18}
          w={Math.min(160, w / columns - 80)}
          d={20}
          paint={frame}
        />,
      )
    }
  }
  return (
    <>
      <Slab h={60} w={w - 80} d={d - 80} paint={frame} />
      <Slab base={60} h={height - 60} w={w} d={d} paint={body} />
      {handles}
    </>
  )
}

const nightstand: Builder = (p) => cabinet(p, 1, 1)
const dresser: Builder = (p) => cabinet(p, 2, 3)
const credenza: Builder = (p) => cabinet(p, 3, 1)
const filing: Builder = (p) => cabinet(p, 1, 3)
const plainBox: Builder = (p) => cabinet(p, 1, 1)

const mediaUnit: Builder = (p) => {
  const { w, d, h } = p
  const screen = Math.min(1300, w * 0.8)
  return (
    <>
      {cabinet(p, 2, 1)}
      <Slab base={h} h={60} w={300} d={200} z={d / 2 - 120} paint={PAINT.dark} />
      <Slab base={h + 60} h={screen * 0.56} w={screen} d={30} z={d / 2 - 120} paint={PAINT.black} />
    </>
  )
}

const BOOK_PAINTS: Paint[] = [
  { color: '#8b4a3c' },
  { color: '#3d5a80' },
  { color: '#e0c78a' },
  { color: '#4f6d4a' },
  { color: '#d9d4cc' },
  { color: '#6b4c7a' },
]

const bookshelf: Builder = ({ w, d, h, body }) => {
  const shelves = Math.max(2, Math.round(h / 380))
  const pitch = h / shelves
  const columns = Math.max(2, Math.floor((w - 100) / 70))
  return (
    <>
      {[-(w / 2 - 12), w / 2 - 12].map((x) => (
        <Slab key={x} x={x} h={h} w={25} d={d} paint={body} />
      ))}
      <Slab h={h} w={w} d={15} z={d / 2 - 8} paint={body} />
      {along(shelves + 1, (i) => Math.min(i * pitch, h - 25)).map((base) => (
        <Slab key={base} base={base} h={25} w={w - 50} d={d - 15} z={-7} paint={body} />
      ))}
      {along(shelves, (row) => row * pitch + 25).flatMap((base) =>
        along(columns, (i) => -w / 2 + 60 + i * 70).map((x) => {
          const nth = Math.round((x + w / 2) / 70 + base / pitch)
          return (
            <Slab
              key={`${x}:${base}`}
              x={x}
              z={-4}
              base={base}
              h={pitch - 65 - (nth % 3) * 40}
              w={50}
              d={d - 60}
              paint={BOOK_PAINTS[nth % BOOK_PAINTS.length]!}
            />
          )
        }),
      )}
    </>
  )
}

const clothingRack: Builder = ({ w, d, h, frame }) => (
  <>
    {[-(w / 2 - 30), w / 2 - 30].map((x) => (
      <Slab key={x} x={x} h={h} w={30} d={30} paint={frame} />
    ))}
    {[-(w / 2 - 30), w / 2 - 30].map((x) => (
      <Slab key={`foot-${x}`} x={x} h={30} w={30} d={d} paint={frame} />
    ))}
    <Slab base={h - 30} h={30} w={w} d={30} paint={frame} />
    {along(Math.floor((w - 120) / 130), (i) => -w / 2 + 90 + i * 130).map((x) => (
      <Slab
        key={x}
        x={x}
        base={h - 900}
        h={870}
        w={60}
        d={d * 0.7}
        paint={BOOK_PAINTS[Math.round((x + w / 2) / 130) % BOOK_PAINTS.length]!}
      />
    ))}
  </>
)

const coatStand: Builder = ({ h, frame }) => (
  <>
    <Drum r={180} h={25} paint={frame} />
    <Drum r={18} base={25} h={h - 25} paint={frame} />
    {[0, 1, 2, 3].map((i) => (
      <Slab key={i} base={h - 120} h={20} w={220} d={20} turn={(i * Math.PI) / 4} paint={frame} />
    ))}
  </>
)

const consoleMirror: Builder = ({ w, d, body, frame }) => (
  <>
    <Slab base={810} h={40} w={w} d={d} paint={body} />
    <Legs w={w} d={d} h={810} thick={40} paint={frame} />
    <Slab base={950} h={800} w={w * 0.8} d={20} z={d / 2 - 10} paint={PAINT.mirror} />
  </>
)

// ---------------------------------------------------------------------------
// Living

/**
 * A sofa: feet, a base, arms, a back, and on the base as many seat cushions
 * as it seats, each with a back cushion leaning on the back behind it.
 */
const sofa: Builder = ({ w, d, body, frame }) => {
  const arm = Math.min(200, w * 0.12)
  const back = 200
  const seats = w > 2000 ? 3 : w > 1300 ? 2 : 1
  const inner = w - 2 * arm
  const gap = 20
  const cushionW = (inner - gap * (seats + 1)) / seats
  const cushionD = d - back - 60
  const cushion = lighter(body, 0.08)
  return (
    <>
      <Legs w={w - 60} d={d - 60} h={90} thick={50} inset={0} paint={frame} />
      <Slab base={90} h={280} w={w} d={d - back} z={-back / 2} paint={body} />
      <Slab base={90} h={720} w={w} d={back} z={d / 2 - back / 2} paint={body} />
      {[-(w / 2 - arm / 2), w / 2 - arm / 2].map((x) => (
        <Slab key={x} x={x} base={90} h={520} w={arm} d={d - 40} z={-20} paint={body} />
      ))}
      {along(seats, (i) => -inner / 2 + gap + cushionW / 2 + i * (cushionW + gap)).map((x) => (
        <group key={x}>
          <Slab
            x={x}
            base={370}
            h={150}
            w={cushionW}
            d={cushionD}
            z={-back / 2 - 10}
            paint={cushion}
          />
          <Lean
            x={x}
            from={[d / 2 - back - 40, 520]}
            to={[d / 2 - back + 60, 900]}
            w={cushionW - 10}
            thick={140}
            paint={cushion}
          />
        </group>
      ))}
    </>
  )
}

const sofaL: Builder = (p) => {
  const { w, d, body, frame } = p
  const run = Math.min(965, d)
  const chaise = { x: -(w / 2 - run / 2), z: -run / 2, d: d - run }
  return (
    <>
      <Put z={d / 2 - run / 2}>{sofa({ ...p, d: run })}</Put>
      <Legs
        x={chaise.x}
        z={chaise.z}
        w={run - 60}
        d={chaise.d - 60}
        h={90}
        thick={50}
        inset={0}
        paint={frame}
      />
      <Slab x={chaise.x} z={chaise.z} base={90} h={280} w={run} d={chaise.d} paint={body} />
      <Slab
        x={chaise.x}
        z={chaise.z}
        base={370}
        h={150}
        w={run - 40}
        d={chaise.d - 20}
        paint={lighter(body, 0.08)}
      />
      <Slab
        x={chaise.x - run / 2 + 100}
        z={chaise.z}
        base={90}
        h={520}
        w={200}
        d={chaise.d}
        paint={body}
      />
    </>
  )
}

const chairOttoman: Builder = (p) => {
  const { w, d, body } = p
  const seat = Math.min(838, d * 0.6)
  return (
    <>
      <Put z={d / 2 - seat / 2}>{sofa({ ...p, d: seat })}</Put>
      <Slab
        z={-(d / 2) + (d - seat - 100) / 2}
        h={400}
        w={w - 120}
        d={d - seat - 100}
        paint={body}
      />
    </>
  )
}

const bench: Builder = ({ w, d, body, frame }) => (
  <>
    <Slab base={400} h={50} w={w} d={d} paint={body} />
    <Legs w={w} d={d} h={400} thick={40} paint={frame} />
  </>
)

/** A top on four legs; inset from the footprint where chairs take the rest. */
function table(part: Part, inset = 0): ReactNode {
  const { w, d, h, body, frame } = part
  return (
    <>
      <Slab base={h - 40} h={40} w={w - 2 * inset} d={d - 2 * inset} paint={body} />
      <Legs w={w - 2 * inset} d={d - 2 * inset} h={h - 40} paint={frame} />
    </>
  )
}

const plainTable: Builder = (p) => table(p)

const chair = (body: Paint, frame: Paint): ReactNode => (
  <>
    <Slab base={420} h={40} w={420} d={420} paint={frame} />
    <Slab base={460} h={30} w={380} d={380} z={-10} paint={body} />
    <Legs w={420} d={420} h={420} thick={34} inset={24} paint={frame} />
    {[-185, 185].map((x) => (
      <Lean key={x} x={x} from={[190, 420]} to={[240, 920]} w={34} thick={34} paint={frame} />
    ))}
    <Lean from={[192, 520]} to={[232, 900]} w={340} thick={26} paint={body} />
  </>
)

/** Where the chairs go round a table: so many a side, their backs outward. */
function seats(w: number, d: number, long: number, ends: number): [number, number, number][] {
  const out: [number, number, number][] = []
  const near = 230
  for (let i = 0; i < long; i += 1) {
    const z = ((i + 0.5) / long - 0.5) * (d - 460)
    out.push([w / 2 - near, z, Math.PI / 2], [-(w / 2 - near), z, -Math.PI / 2])
  }
  for (let i = 0; i < ends; i += 1) {
    const x = ((i + 0.5) / ends - 0.5) * (w - 460)
    out.push([x, -(d / 2 - near), Math.PI], [x, d / 2 - near, 0])
  }
  return out
}

function dining(long: number, ends: number, round = false): Builder {
  return (p) => {
    const { w, d, h, body, frame } = p
    const top = round ? (
      <>
        <Drum base={h - 40} r={Math.min(w, d) / 2 - 350} h={40} paint={body} />
        <Drum r={70} h={h - 40} paint={frame} />
        <Drum r={260} h={30} paint={frame} />
      </>
    ) : (
      table(p, 350)
    )
    return (
      <>
        {top}
        {seats(w, d, long, ends).map(([x, z, turn]) => (
          <Put key={`${x}:${z}`} x={x} z={z} turn={turn}>
            {chair(lighter(body, 0.2), frame)}
          </Put>
        ))}
      </>
    )
  }
}

const officeDesk: Builder = ({ w, d, h, body, frame }) => (
  <>
    <Slab base={h - 40} h={40} w={w} d={d} paint={body} />
    {[-(w / 2 - 40), w / 2 - 40].map((x) => (
      <Slab key={x} x={x} h={h - 40} w={80} d={d - 100} paint={frame} />
    ))}
    <Slab base={h - 640} h={600} w={w - 160} d={30} z={d / 2 - 60} paint={frame} />
  </>
)

const officeDeskL: Builder = (p) => {
  const { w, d, h, body, frame } = p
  const run = 800
  return (
    <>
      <Slab base={h - 40} h={40} w={w} d={run} z={d / 2 - run / 2} paint={body} />
      <Slab
        base={h - 40}
        h={40}
        w={run}
        d={d - run}
        x={-(w / 2 - run / 2)}
        z={-run / 2}
        paint={body}
      />
      <Slab x={w / 2 - 40} z={d / 2 - run / 2} h={h - 40} w={80} d={run - 100} paint={frame} />
      <Slab
        x={-(w / 2 - run / 2)}
        z={-(d / 2 - 40)}
        h={h - 40}
        w={run - 100}
        d={80}
        paint={frame}
      />
      <Slab x={-(w / 2 - 40)} z={d / 2 - run / 2} h={h - 40} w={80} d={run - 100} paint={frame} />
    </>
  )
}

const officeChair: Builder = ({ body, frame }) => (
  <>
    {along(5, (i) => (i * 2 * Math.PI) / 5).map((turn) => (
      <Slab
        key={turn}
        x={Math.sin(turn) * 150}
        z={Math.cos(turn) * 150}
        h={30}
        w={60}
        d={300}
        turn={turn}
        paint={frame}
      />
    ))}
    {along(5, (i) => (i * 2 * Math.PI) / 5).map((turn) => (
      <Drum
        key={turn}
        x={Math.sin(turn) * 270}
        z={Math.cos(turn) * 270}
        r={28}
        h={40}
        paint={PAINT.dark}
      />
    ))}
    <Drum r={30} base={30} h={400} paint={frame} />
    <Slab base={430} h={90} w={500} d={500} paint={body} />
    <Lean from={[220, 520]} to={[270, 1000]} w={460} thick={60} paint={body} />
    {[-270, 270].map((x) => (
      <Slab key={x} x={x} base={650} h={30} w={60} d={300} paint={frame} />
    ))}
  </>
)

const poolTable: Builder = ({ w, d, h, body, frame }) => (
  <>
    <Slab h={h - 100} w={w - 200} d={d - 200} paint={frame} />
    <Slab base={h - 100} h={100} w={w} d={d} paint={body} />
    <Slab base={h} h={8} w={w - 260} d={d - 260} paint={PAINT.felt} />
  </>
)

const pingPong: Builder = ({ w, d, h, frame }) => (
  <>
    <Slab base={h - 30} h={30} w={w} d={d} paint={{ color: '#2c5aa0' }} />
    <Legs w={w} d={d} h={h - 30} inset={200} thick={40} paint={frame} />
    <Slab base={h} h={150} w={w + 100} d={10} paint={PAINT.porcelain} />
  </>
)

const bar: Builder = (p) => {
  const { w, d, h, body } = p
  return (
    <>
      {cabinet({ ...p, d: d - 60 }, 3, 1, h - 40)}
      <Slab base={h - 40} h={40} w={w + 40} d={d + 60} z={-40} paint={body} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Kitchen

/** A run of base cabinets under a worktop, its front at -z, with handles along it. */
function run(
  p: Part,
  {
    x = 0,
    z = 0,
    w = p.w,
    d = p.d,
    upper = false,
  }: { x?: number; z?: number; w?: number; d?: number; upper?: boolean },
): ReactNode {
  const { body, frame } = p
  const doors = Math.max(1, Math.round(w / 600))
  return (
    <group position={[x * MM, 0, z * MM]}>
      <Slab z={30} h={100} w={w - 60} d={d - 80} paint={PAINT.dark} />
      <Slab z={10} base={100} h={760} w={w} d={d - 20} paint={body} />
      <Slab base={860} h={40} w={w} d={d} paint={PAINT.worktop} />
      {along(doors, (i) => -w / 2 + ((i + 0.5) * w) / doors).map((x) => (
        <Slab
          key={x}
          x={x}
          z={-d / 2 + 10 - 12}
          base={720}
          h={24}
          w={Math.min(200, w / doors - 60)}
          d={28}
          paint={frame}
        />
      ))}
      {upper ? <Slab z={d / 2 - 175} base={1450} h={700} w={w} d={350} paint={body} /> : null}
    </group>
  )
}

const sinkBasin = (x: number, z: number): ReactNode => (
  <>
    <Slab x={x} z={z} base={900} h={8} w={720} d={420} paint={PAINT.steel} />
    <Slab x={x} z={z} base={904} h={6} w={650} d={350} paint={PAINT.dark} />
    <Drum x={x} z={z + 250} base={900} r={14} h={260} paint={PAINT.steel} />
    <Slab x={x} z={z + 150} base={1140} h={20} w={20} d={200} paint={PAINT.steel} />
  </>
)

const kitchenI =
  (upper: boolean): Builder =>
  (p) =>
    run(p, { upper })

const kitchenL =
  (upper: boolean): Builder =>
  (p) => {
    const { w, d } = p
    const deep = Math.min(650, d / 2)
    return (
      <>
        {run(p, { z: d / 2 - deep / 2, d: deep, upper })}
        <Put x={-(w / 2 - deep / 2)} z={-deep / 2} turn={-Math.PI / 2}>
          {run(p, { w: d - deep, d: deep, upper })}
        </Put>
      </>
    )
  }

const kitchenU =
  (upper: boolean): Builder =>
  (p) => {
    const { w, d } = p
    const deep = Math.min(650, d / 2, w / 3)
    return (
      <>
        {run(p, { z: d / 2 - deep / 2, d: deep, upper })}
        <Put x={-(w / 2 - deep / 2)} z={-deep / 2} turn={-Math.PI / 2}>
          {run(p, { w: d - deep, d: deep, upper })}
        </Put>
        <Put x={w / 2 - deep / 2} z={-deep / 2} turn={Math.PI / 2}>
          {run(p, { w: d - deep, d: deep, upper })}
        </Put>
      </>
    )
  }

const kitchenSink: Builder = (p) => (
  <>
    {run(p, {})}
    {sinkBasin(0, 20)}
  </>
)

const stove: Builder = (p) => {
  const { w, d, frame } = p
  return (
    <>
      {run({ ...p, body: PAINT.steel, frame: PAINT.dark }, {})}
      <Slab base={900} h={10} w={w - 40} d={d - 40} paint={PAINT.black} />
      {[-w / 4, w / 4].map((x) =>
        [-d / 5, d / 5].map((z) => (
          <Drum key={`${x}:${z}`} x={x} z={z} base={910} r={95} h={8} paint={PAINT.dark} />
        )),
      )}
      <Slab base={900} h={120} w={w} d={40} z={d / 2 - 20} paint={PAINT.steel} />
      <Slab base={560} h={12} w={w - 60} d={12} z={-d / 2 - 6} paint={frame} />
    </>
  )
}

const fridge: Builder = ({ w, d, h, body, frame }) => (
  <>
    <Slab h={h} w={w} d={d} paint={body} />
    <Slab base={h * 0.68} h={12} w={w} d={12} z={-d / 2 - 4} paint={PAINT.dark} />
    <Slab
      x={-(w / 2 - 90)}
      z={-d / 2 - 18}
      base={h * 0.72}
      h={h * 0.2}
      w={22}
      d={30}
      paint={frame}
    />
    <Slab
      x={-(w / 2 - 90)}
      z={-d / 2 - 18}
      base={h * 0.3}
      h={h * 0.3}
      w={22}
      d={30}
      paint={frame}
    />
  </>
)

const dishwasher: Builder = (p) => (
  <>
    {run({ ...p, frame: PAINT.dark }, {})}
    <Slab base={830} h={40} w={p.w - 40} d={10} z={-p.d / 2 - 5} paint={PAINT.dark} />
  </>
)

const island =
  (basin: boolean): Builder =>
  (p) => {
    const { w, d, frame } = p
    const stools = Math.max(2, Math.round(w / 700))
    const counter = d - 450
    return (
      <>
        {run(p, { z: 225, d: counter })}
        <Slab base={860} h={40} w={w} d={d - 100} z={-50} paint={PAINT.worktop} />
        {basin ? sinkBasin(0, 250) : null}
        {along(stools, (i) => -w / 2 + ((i + 0.5) * w) / stools).map((x) => {
          return (
            <group key={`stool-${x}`}>
              <Drum x={x} z={-d / 2 + 200} r={170} h={20} paint={frame} />
              <Drum x={x} z={-d / 2 + 200} base={20} r={20} h={640} paint={frame} />
              <Drum x={x} z={-d / 2 + 200} base={660} r={180} h={50} paint={lighter(frame, 0.3)} />
            </group>
          )
        })}
      </>
    )
  }

const waterHeater: Builder = ({ w, h }) => (
  <>
    <Drum r={w / 2} h={h} paint={PAINT.porcelain} />
    <Drum r={w / 2 - 40} base={h} h={40} paint={PAINT.steel} />
  </>
)

const hvac: Builder = ({ w, d, h }) => (
  <>
    <Slab h={h} w={w} d={d} paint={PAINT.steel} />
    <Slab base={h} h={20} w={w - 100} d={d - 100} paint={PAINT.dark} />
  </>
)

// ---------------------------------------------------------------------------
// Bathroom and laundry

const toilet: Builder = ({ w, d }) => {
  const bowl = d - 250
  const r = (w - 80) / 2
  return (
    <>
      <Slab base={380} h={420} w={w - 60} d={190} z={d / 2 - 95} paint={PAINT.porcelain} />
      <Slab base={800} h={25} w={90} d={50} z={d / 2 - 95} paint={PAINT.steel} />
      <Drum
        z={-(d / 2) + bowl / 2 + 20}
        r={r}
        h={380}
        stretch={bowl / (2 * r)}
        paint={PAINT.porcelain}
      />
      <Drum
        z={-(d / 2) + bowl / 2 + 20}
        base={380}
        r={r + 15}
        h={35}
        stretch={bowl / (2 * r)}
        paint={PAINT.pale}
      />
    </>
  )
}

function vanity(basins: number): Builder {
  return (p) => {
    const { w, d, body } = p
    return (
      <>
        <Slab z={30} h={100} w={w - 80} d={d - 100} paint={PAINT.dark} />
        <Slab z={10} base={100} h={700} w={w} d={d - 20} paint={body} />
        <Slab base={800} h={50} w={w} d={d} paint={PAINT.worktop} />
        {along(basins, (i) => -w / 2 + ((i + 0.5) * w) / basins).map((x) => {
          return (
            <group key={x}>
              <Drum x={x} z={-20} base={850} r={215} h={10} stretch={0.8} paint={PAINT.porcelain} />
              <Drum x={x} z={-20} base={855} r={185} h={8} stretch={0.8} paint={PAINT.pale} />
              <Drum x={x} z={d / 2 - 110} base={850} r={14} h={190} paint={PAINT.steel} />
              <Slab x={x} z={d / 2 - 180} base={1020} h={18} w={18} d={160} paint={PAINT.steel} />
            </group>
          )
        })}
        <Slab base={1000} h={800} w={w - 160} d={20} z={d / 2 - 10} paint={PAINT.mirror} />
      </>
    )
  }
}

const bathtub: Builder = ({ w, d }) => (
  <>
    <Slab h={120} w={w - 180} d={d - 180} paint={PAINT.pale} />
    {[-(d / 2 - 45), d / 2 - 45].map((z) => (
      <Slab key={z} z={z} h={550} w={w} d={90} paint={PAINT.porcelain} />
    ))}
    {[-(w / 2 - 45), w / 2 - 45].map((x) => (
      <Slab key={x} x={x} h={550} w={90} d={d - 180} paint={PAINT.porcelain} />
    ))}
    <Drum x={w / 2 - 45} z={d / 2 - 250} base={550} r={14} h={160} paint={PAINT.steel} />
    <Slab x={w / 2 - 130} z={d / 2 - 250} base={690} h={18} w={180} d={18} paint={PAINT.steel} />
  </>
)

const shower: Builder = ({ w, d }) => (
  <>
    <Slab h={60} w={w} d={d} paint={PAINT.pale} />
    <Slab base={60} h={4} w={90} d={90} paint={PAINT.steel} />
    <Slab base={60} h={1900} w={w - 40} d={12} z={-d / 2 + 6} paint={PAINT.glass} />
    <Slab base={60} h={1900} w={12} d={d - 40} x={w / 2 - 6} paint={PAINT.glass} />
    <Slab h={1960} w={30} d={30} x={w / 2 - 15} z={-d / 2 + 15} paint={PAINT.dark} />
    <Slab h={1960} w={30} d={30} x={-(w / 2 - 15)} z={-d / 2 + 15} paint={PAINT.dark} />
    <Drum x={-(w / 2) + 250} z={d / 2 - 30} base={900} r={12} h={1100} paint={PAINT.steel} />
    <Slab
      x={-(w / 2) + 250 + 100}
      z={d / 2 - 130}
      base={2000}
      h={16}
      w={200}
      d={16}
      paint={PAINT.steel}
    />
    <Drum x={-(w / 2) + 250 + 180} z={d / 2 - 180} base={1980} r={90} h={16} paint={PAINT.steel} />
  </>
)

const machine = (x: number, base: number, w: number, d: number): ReactNode => (
  <group key={`${x}:${base}`}>
    <Slab x={x} base={base} h={850} w={w} d={d} paint={PAINT.porcelain} />
    <Disc x={x} y={base + 400} z={-d / 2 - 15} r={240} thick={30} paint={PAINT.steel} />
    <Disc x={x} y={base + 400} z={-d / 2 - 32} r={200} thick={6} paint={PAINT.tinted} />
    <Slab x={x} z={-d / 2 - 4} base={base + 780} h={40} w={w - 60} d={8} paint={PAINT.dark} />
  </group>
)

const washerPair: Builder = ({ w, d }) => (
  <>
    {machine(-w / 4, 0, w / 2 - 20, d - 60)}
    {machine(w / 4, 0, w / 2 - 20, d - 60)}
  </>
)

const washerStack: Builder = ({ w, d }) => (
  <>
    {machine(0, 0, w - 20, d - 60)}
    {machine(0, 900, w - 20, d - 60)}
  </>
)

// ---------------------------------------------------------------------------
// Odds and ends

const plant: Builder = ({ w, h }) => (
  <>
    <Drum r={w * 0.2} top={w * 0.25} h={h * 0.32} paint={PAINT.terracotta} open />
    <Drum base={h * 0.32 - 40} r={w * 0.23} h={10} paint={PAINT.soil} />
    <Ball y={h * 0.68} r={w * 0.34} paint={PAINT.leaf} />
    <Ball x={w * 0.2} y={h * 0.56} z={w * 0.1} r={w * 0.26} paint={PAINT.leafDark} />
    <Ball x={-w * 0.17} y={h * 0.62} z={-w * 0.15} r={w * 0.25} paint={PAINT.leafLight} />
    <Ball x={-w * 0.05} y={h * 0.84} z={w * 0.12} r={w * 0.2} paint={PAINT.leafLight} />
  </>
)

const floorLamp: Builder = ({ h, frame }) => (
  <>
    <Drum r={150} h={20} paint={frame} />
    <Drum base={20} r={14} h={h - 320} paint={frame} />
    <Drum base={h - 300} r={240} top={140} h={300} paint={PAINT.shade} open />
    <Drum base={h - 200} r={40} h={60} paint={PAINT.lamp} />
  </>
)

const tableLamp: Builder = ({ h, frame }) => (
  <>
    <Drum r={90} h={20} paint={frame} />
    <Drum base={20} r={12} h={h - 240} paint={frame} />
    <Drum base={h - 220} r={170} top={100} h={220} paint={PAINT.shade} open />
  </>
)

/**
 * A car, front at -z: a body to the belt line, a greenhouse on it with the
 * windscreen and rear window leaning at the car's own angles, pillars, a
 * roof, wheels showing under the sills, lights and bumpers at both ends.
 * An SUV is the same, taller and squarer at the back.
 */
const car = (suv: boolean): Builder => {
  return ({ w, d, body }) => {
    const front = -d / 2
    const rear = d / 2
    const floor = 340
    const belt = suv ? 920 : 800
    const roof = suv ? 1680 : 1420
    const screenFoot = front + d * (suv ? 0.3 : 0.34)
    const screenTop = screenFoot + d * (suv ? 0.13 : 0.16)
    const rearTop = rear - d * (suv ? 0.07 : 0.3)
    const rearFoot = rear - d * (suv ? 0.03 : 0.16)
    const glassW = w - 160
    const span = rearTop - screenTop
    return (
      <>
        <Slab base={floor} h={belt - floor} w={w} d={d} paint={body} />
        <Slab
          base={belt}
          h={roof - belt - 60}
          w={glassW}
          d={span}
          z={(screenTop + rearTop) / 2}
          paint={PAINT.tinted}
        />
        <Lean
          from={[screenFoot, belt]}
          to={[screenTop, roof - 30]}
          w={glassW + 20}
          thick={40}
          paint={PAINT.tinted}
        />
        <Lean
          from={[rearFoot, belt]}
          to={[rearTop, roof - 30]}
          w={glassW + 20}
          thick={40}
          paint={PAINT.tinted}
        />
        <Slab
          base={roof - 60}
          h={60}
          w={glassW + 40}
          d={span + 80}
          z={(screenTop + rearTop) / 2}
          paint={body}
        />
        {[-(glassW / 2), glassW / 2].map((x) => (
          <group key={x}>
            <Lean
              x={x}
              from={[screenFoot, belt]}
              to={[screenTop, roof - 30]}
              w={70}
              thick={90}
              paint={body}
            />
            <Lean
              x={x}
              from={[rearFoot, belt]}
              to={[rearTop, roof - 30]}
              w={70}
              thick={90}
              paint={body}
            />
            <Slab
              x={x}
              base={belt}
              h={roof - belt - 60}
              w={70}
              d={80}
              z={(screenTop + rearTop) / 2}
              paint={body}
            />
          </group>
        ))}
        {[-(w / 2 - 90), w / 2 - 90].map((x) =>
          [front + 900, rear - 900].map((z) => (
            <group key={`${x}:${z}`}>
              <Disc x={x} y={340} z={z} r={340} thick={230} facing="side" paint={PAINT.black} />
              <Disc x={x} y={340} z={z} r={150} thick={240} facing="side" paint={PAINT.steel} />
            </group>
          )),
        )}
        {[-(w / 2 - 240), w / 2 - 240].map((x) => (
          <Slab
            key={`front-${x}`}
            x={x}
            z={front - 5}
            base={belt - 250}
            h={140}
            w={300}
            d={12}
            paint={PAINT.lamp}
          />
        ))}
        {[-(w / 2 - 240), w / 2 - 240].map((x) => (
          <Slab
            key={`rear-${x}`}
            x={x}
            z={rear + 5}
            base={belt - 250}
            h={120}
            w={300}
            d={12}
            paint={PAINT.red}
          />
        ))}
        <Slab z={front - 8} base={floor} h={140} w={w - 60} d={16} paint={PAINT.dark} />
        <Slab z={rear + 8} base={floor} h={140} w={w - 60} d={16} paint={PAINT.dark} />
        <Slab z={front - 6} base={belt - 220} h={120} w={w * 0.36} d={12} paint={PAINT.dark} />
        {[-(w / 2 + 60), w / 2 + 60].map((x) => (
          <Slab
            key={`mirror-${x}`}
            x={x}
            z={screenFoot + 60}
            base={belt + 60}
            h={90}
            w={120}
            d={80}
            paint={body}
          />
        ))}
      </>
    )
  }
}

/**
 * A flight, built from the treads the plan draws.
 *
 * Not a straight run of slabs whatever the kind, which is what it was: a winder
 * came out as a ramp through its own wall, and a spiral as a box. The treads are
 * `treadsOf`, so the flight climbed here is the flight drawn from above, right
 * down to how many steps it takes.
 *
 * `h` is the storey it climbs — the walk hands a staircase its floor-to-floor
 * height, not the catalogue's — so the last tread is one riser under the floor
 * above and the floor above is the step onto it.
 */
const staircase =
  (kind: StairKind): Builder =>
  ({ w, h, body, frame }) => {
    const shape = stairShape(kind, h, flightWidthOf(kind, w, h))
    const rise = h / shape.risers
    const treads = treadsOf(shape)

    return (
      <>
        {/* Each tread solid to the floor, which is how a stair in a house is
            built and what makes it read as one from underneath, through the well. */}
        {treads.map((tread) => (
          <Slab
            key={tread.step}
            base={0}
            h={tread.step * rise}
            w={tread.width}
            d={tread.depth}
            // The symbol's y runs back to front and its top edge is the thing's
            // back, which is +z here.
            x={tread.cx - shape.size.width / 2}
            z={shape.size.depth / 2 - tread.cy}
            turn={tread.turn}
            paint={body}
          />
        ))}
        {kind === 'spiral' ? (
          <Drum r={Math.max(60, (shape.flight / 2) * 0.16)} h={h} paint={frame} />
        ) : null}
      </>
    )
  }

const column: Builder = ({ w, d, h }) => <Slab h={h} w={w} d={d} paint={PAINT.wall} />

const railing: Builder = ({ w, d, h, frame }) => {
  const posts = Math.max(2, Math.round(w / 900) + 1)
  return (
    <>
      {along(posts, (i) => -w / 2 + 20 + (i * (w - 40)) / (posts - 1)).map((x) => (
        <Slab key={x} x={x} h={h} w={40} d={Math.max(d, 40)} paint={frame} />
      ))}
      <Slab base={h - 40} h={40} w={w} d={Math.max(d, 50)} paint={frame} />
      <Slab base={100} h={h - 160} w={w - 40} d={12} paint={PAINT.glass} />
    </>
  )
}

const pictureFrame: Builder = ({ w, d, h, frame }) => (
  <>
    <Slab h={h} w={w} d={d} paint={frame} />
    <Slab base={40} h={h - 80} w={w - 80} d={d + 4} z={-2} paint={PAINT.canvas} />
  </>
)

const treadmill: Builder = ({ w, d, h, body, frame }) => (
  <>
    <Slab base={80} h={120} w={w - 200} d={d * 0.72} z={-d * 0.12} paint={PAINT.dark} />
    <Slab h={80} w={w - 100} d={d * 0.78} z={-d * 0.1} paint={frame} />
    <Slab base={0} h={h} w={w} d={120} z={d / 2 - 60} paint={body} />
    {[-(w / 2 - 40), w / 2 - 40].map((x) => (
      <Slab key={x} x={x} base={900} h={40} w={40} d={d * 0.6} z={d * 0.15} paint={frame} />
    ))}
  </>
)

const exerciseBike: Builder = ({ w, d, frame, body }) => (
  <>
    {[-(d / 2 - 60), d / 2 - 60].map((z) => (
      <Slab key={z} z={z} h={40} w={w} d={60} paint={frame} />
    ))}
    <Slab h={60} w={80} d={d - 120} paint={frame} />
    <Disc y={400} z={-d / 4} r={300} thick={80} facing="side" paint={PAINT.dark} />
    <Drum z={d / 4} base={60} r={30} h={800} paint={frame} />
    <Slab z={d / 4} base={860} h={60} w={260} d={300} paint={body} />
    <Drum z={-d / 4} base={60} r={30} h={1000} paint={frame} />
    <Slab z={-d / 4} base={1060} h={30} w={w - 100} d={60} paint={frame} />
  </>
)

const weightRack: Builder = ({ w, d, h, frame }) => (
  <>
    {[-(w / 2 - 30), w / 2 - 30].map((x) => (
      <Slab key={x} x={x} h={h} w={60} d={d} paint={frame} />
    ))}
    {[0.2, 0.55, 0.9].map((at) => (
      <Slab key={at} base={h * at} h={40} w={w - 120} d={d} paint={frame} />
    ))}
    {[0.2, 0.55, 0.9].flatMap((at) =>
      [-0.3, 0, 0.3].map((along) => (
        <Disc
          key={`${at}:${along}`}
          x={along * (w - 200)}
          y={h * at + 40 + 60}
          r={60}
          thick={260}
          facing="side"
          paint={PAINT.dark}
        />
      )),
    )}
  </>
)

const gymBench: Builder = ({ w, d, body, frame }) => (
  <>
    <Slab base={420} h={60} w={w} d={d} paint={body} />
    <Legs w={w} d={d} h={420} thick={40} inset={80} paint={frame} />
  </>
)

const bbq: Builder = ({ w, d }) => (
  <>
    <Slab h={900} w={w * 0.6} d={d} x={-w * 0.2} paint={PAINT.steel} />
    <Slab base={900} h={220} w={w * 0.6} d={d} x={-w * 0.2} paint={PAINT.dark} />
    <Slab base={880} h={20} w={w * 0.36} d={d - 100} x={w * 0.3} paint={PAINT.steel} />
    <Legs w={w * 0.36} d={d - 100} h={880} x={w * 0.3} thick={30} inset={30} paint={PAINT.dark} />
  </>
)

// ---------------------------------------------------------------------------
// The catalogue, by type

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

/** Whether a type has a model of its own; without one it is drawn as its box with its symbol on top. */
export const modelled = (type: string): boolean => type in BUILDERS

/** The model of a thing, in its own frame; nothing for a type without one. */
export function Model({ type, part }: { type: string; part: Part }) {
  const build = BUILDERS[type]
  return build ? <>{build(part)}</> : null
}
