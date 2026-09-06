import { PAINT } from '../finish'
import { type Builder, Disc, Lean, Slab } from './parts'

export const car = (suv: boolean): Builder => {
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
