import { z } from 'zod'

const mm = z.number().int()
const PointSchema = z.object({ x: mm, y: mm })
export const StairFlightSchema = z.object({
  x: mm,
  y: mm,
  direction: z.enum(['north', 'south', 'east', 'west']),
  width: mm.positive(),
  going: mm.positive(),
  risers: mm.min(2),
  landing: z.array(PointSchema).min(4).optional(),
})
export const StairRunSchema = z
  .object({
    id: z.string().min(1),
    to: z.string().min(1),
    baseOffset: mm.default(0),
    flights: z.array(StairFlightSchema).min(1),
    thickness: mm.positive(),
    colour: z.string().regex(/^#[0-9a-f]{6}$/i),
  })
  .superRefine((s, ctx) => {
    s.flights.forEach((flight, index) => {
      if (index < s.flights.length - 1 && !flight.landing)
        ctx.addIssue({
          code: 'custom',
          path: ['flights', index],
          message: 'a flight needs a landing before the next flight',
        })
      if (index === s.flights.length - 1 && flight.landing)
        ctx.addIssue({
          code: 'custom',
          path: ['flights', index],
          message: 'the destination floor is the final landing',
        })
      flight.landing?.forEach((p, i, loop) => {
        const next = loop[(i + 1) % loop.length]!
        if ((p.x === next.x) === (p.y === next.y))
          ctx.addIssue({
            code: 'custom',
            path: ['flights', index, 'landing'],
            message: 'landing must have nonzero orthogonal edges',
          })
      })
    })
  })
export type StairRun = z.infer<typeof StairRunSchema>

export function flightTreads(stair: StairRun) {
  let step = 0
  return stair.flights.flatMap((flight) => {
    const dx = flight.direction === 'east' ? 1 : flight.direction === 'west' ? -1 : 0
    const dy = flight.direction === 'north' ? 1 : flight.direction === 'south' ? -1 : 0
    const at = (along: number, aside: number) => ({
      x: flight.x + dx * along - dy * aside,
      y: flight.y + dy * along + dx * aside,
    })
    const treads = Array.from({ length: flight.risers - 1 }, (_, index) => ({
      step: ++step,
      outline: [
        at(index * flight.going, -flight.width / 2),
        at((index + 1) * flight.going, -flight.width / 2),
        at((index + 1) * flight.going, flight.width / 2),
        at(index * flight.going, flight.width / 2),
      ],
    }))
    step++
    if (flight.landing) treads.push({ step, outline: flight.landing })
    return treads
  })
}
