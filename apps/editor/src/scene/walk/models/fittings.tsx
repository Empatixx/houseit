import { PAINT } from '../finish'
import { along, Ball, type Builder, Drum, Legs, Slab } from './parts'

export const plant: Builder = ({ w, h }) => (
  <>
    <Drum r={w * 0.2} top={w * 0.25} h={h * 0.32} paint={PAINT.terracotta} open />
    <Drum base={h * 0.32 - 40} r={w * 0.23} h={10} paint={PAINT.soil} />
    <Ball y={h * 0.68} r={w * 0.34} paint={PAINT.leaf} />
    <Ball x={w * 0.2} y={h * 0.56} z={w * 0.1} r={w * 0.26} paint={PAINT.leafDark} />
    <Ball x={-w * 0.17} y={h * 0.62} z={-w * 0.15} r={w * 0.25} paint={PAINT.leafLight} />
    <Ball x={-w * 0.05} y={h * 0.84} z={w * 0.12} r={w * 0.2} paint={PAINT.leafLight} />
  </>
)

export const floorLamp: Builder = ({ h, frame }) => (
  <>
    <Drum r={150} h={20} paint={frame} />
    <Drum base={20} r={14} h={h - 320} paint={frame} />
    <Drum base={h - 300} r={240} top={140} h={300} paint={PAINT.shade} open />
    <Drum base={h - 200} r={40} h={60} paint={PAINT.lamp} />
  </>
)

export const tableLamp: Builder = ({ h, frame }) => (
  <>
    <Drum r={90} h={20} paint={frame} />
    <Drum base={20} r={12} h={h - 240} paint={frame} />
    <Drum base={h - 220} r={170} top={100} h={220} paint={PAINT.shade} open />
  </>
)

export const column: Builder = ({ w, d, h }) => <Slab h={h} w={w} d={d} paint={PAINT.wall} />

export const railing: Builder = ({ w, d, h, frame }) => {
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

export const pictureFrame: Builder = ({ w, d, h, frame }) => (
  <>
    <Slab h={h} w={w} d={d} paint={frame} />
    <Slab base={40} h={h - 80} w={w - 80} d={d + 4} z={-2} paint={PAINT.canvas} />
  </>
)

export const bbq: Builder = ({ w, d }) => (
  <>
    <Slab h={900} w={w * 0.6} d={d} x={-w * 0.2} paint={PAINT.steel} />
    <Slab base={900} h={220} w={w * 0.6} d={d} x={-w * 0.2} paint={PAINT.dark} />
    <Slab base={880} h={20} w={w * 0.36} d={d - 100} x={w * 0.3} paint={PAINT.steel} />
    <Legs w={w * 0.36} d={d - 100} h={880} x={w * 0.3} thick={30} inset={30} paint={PAINT.dark} />
  </>
)
