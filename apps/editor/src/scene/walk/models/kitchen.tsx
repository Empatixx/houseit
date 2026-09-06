import type { ReactNode } from 'react'
import { MM } from '../../plan-coordinates'
import { lighter, PAINT } from '../finish'
import { along, type Builder, Drum, type Part, Put, Slab } from './parts'

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

export const kitchenI =
  (upper: boolean): Builder =>
  (p) =>
    run(p, { upper })

export const kitchenL =
  (upper: boolean): Builder =>
  (p) => {
    const { w, d } = p
    const deep = Math.min(650, d / 2)
    return (
      <>
        {run(p, { z: d / 2 - deep / 2, d: deep, upper })}
        <Put x={w / 2 - deep / 2} z={-deep / 2} turn={Math.PI / 2}>
          {run(p, { w: d - deep, d: deep, upper })}
        </Put>
      </>
    )
  }

export const kitchenU =
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

export const kitchenSink: Builder = (p) => (
  <>
    {run(p, {})}
    {sinkBasin(0, 20)}
  </>
)

export const stove: Builder = (p) => {
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

export const fridge: Builder = ({ w, d, h, body, frame }) => (
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

export const dishwasher: Builder = (p) => (
  <>
    {run({ ...p, frame: PAINT.dark }, {})}
    <Slab base={830} h={40} w={p.w - 40} d={10} z={-p.d / 2 - 5} paint={PAINT.dark} />
  </>
)

export const island =
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

export const waterHeater: Builder = ({ w, h }) => (
  <>
    <Drum r={w / 2} h={h} paint={PAINT.porcelain} />
    <Drum r={w / 2 - 40} base={h} h={40} paint={PAINT.steel} />
  </>
)

export const hvac: Builder = ({ w, d, h }) => (
  <>
    <Slab h={h} w={w} d={d} paint={PAINT.steel} />
    <Slab base={h} h={20} w={w - 100} d={d - 100} paint={PAINT.dark} />
  </>
)
