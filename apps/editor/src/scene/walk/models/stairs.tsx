import {
  flightWidthOf,
  type Point,
  type StairKind,
  stairShape,
  treadsOf,
} from '@houseit/core/stairs'
import { Shape } from 'three'
import { MM } from '../../plan-coordinates'
import type { Paint } from '../finish'
import { type Builder, Drum, Finish } from './parts'

export const staircase =
  (kind: StairKind): Builder =>
  ({ w, h, body, frame }) => {
    const shape = stairShape(kind, h, flightWidthOf(kind, w, h))
    const rise = h / shape.risers

    return (
      <>
        {treadsOf(shape).map((tread) => (
          <Step
            key={tread.step}
            outline={tread.outline}
            size={shape.size}
            base={(tread.step - 1) * rise}
            h={rise}
            paint={body}
          />
        ))}
        {kind === 'spiral' ? (
          <Drum r={Math.max(60, (shape.flight / 2) * 0.16)} h={h} paint={frame} />
        ) : null}
      </>
    )
  }

type StepProps = {
  outline: Point[]
  size: { width: number; depth: number }
  base: number
  h: number
  paint: Paint
}

function Step({ outline, size, base, h, paint }: StepProps) {
  const shape = new Shape()
  outline.forEach((point, index) => {
    const x = (size.width / 2 - point.x) * MM
    const y = (point.y - size.depth / 2) * MM
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })
  shape.closePath()
  return (
    <mesh position={[0, base * MM, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <extrudeGeometry args={[shape, { depth: h * MM, bevelEnabled: false }]} />
      <Finish paint={paint} />
    </mesh>
  )
}
