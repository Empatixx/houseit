import { flightWidthOf, type StairKind, stairShape, treadsOf } from '@houseit/core/stairs'
import { drum, prism } from '../pieces'
import type { Builder } from './builder'

export const staircase =
  (kind: StairKind): Builder =>
  ({ w, h, body, frame }) => {
    const shape = stairShape(kind, h, flightWidthOf(kind, w, h))
    const rise = h / shape.risers

    return [
      ...treadsOf(shape).map((tread) =>
        prism({
          outline: tread.outline.map((point) => ({
            x: shape.size.width / 2 - point.x,
            z: shape.size.depth / 2 - point.y,
          })),
          base: (tread.step - 1) * rise,
          thickness: rise,
          paint: body,
        }),
      ),
      ...(kind === 'spiral'
        ? [drum({ r: Math.max(60, (shape.flight / 2) * 0.16), h, paint: frame })]
        : []),
    ]
  }
