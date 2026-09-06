import { levelBelow } from '@houseit/core/levels'
import { stairKind, stairShape, stairSymbol } from '@houseit/core/stairs'
import { surfaceOf } from '@houseit/core/surfaces'
import { roomsOf } from '@houseit/geometry/rooms'
import { standingAt } from '@houseit/geometry/standing'
import { useMemo } from 'react'
import { pick } from '../edit/pick'
import { useDocument, usePlanDoc } from '../store/store'
import { dragged } from './drag'
import { useSymbol } from './furniture/use-symbol'
import { MM, toWorld } from './plan-coordinates'

/**
 * The stairs coming up from the storey below, seen through the hole they make.
 *
 * Not a decoration and not a ghost: the flight is really there, a storey down,
 * and the floor you are standing on is really missing over it. So it is drawn
 * where it is — under this floor — and what shows of it is exactly what the
 * well leaves showing, the way it would if you looked down.
 *
 * Without it an upper floor has an empty hole in it and no way of telling that
 * the hole is the way down. A click on it picks the flight, the way a click on
 * anything else picks that: the stairs you can see are the stairs you can
 * choose, whichever storey you are looking at.
 */
export function StairsBelow() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)

  const flights = useMemo(() => {
    const under = levelBelow(doc, level)
    if (!under) return []
    const rooms = new Map(
      roomsOf(doc, under.id)
        .filter((room) => room.id)
        .map((room) => [room.id!, room] as const),
    )

    return Object.values(doc.objects).flatMap((object) => {
      if (object.level !== under.id) return []
      const kind = stairKind(object.type)
      const room = rooms.get(object.room)
      const spot = kind && room ? standingAt(doc, under.id, room, object) : undefined
      const surface = surfaceOf(object.surface)
      if (!kind || !spot || !surface) return []
      const shape = stairShape(kind, under.height, object.width)
      return [
        {
          id: object.id,
          spot,
          surface,
          size: { width: object.width, depth: object.depth },
          drawing: {
            key: `stairs:${kind}:${under.height}:${object.width}`,
            svg: stairSymbol(shape),
          },
        },
      ]
    })
  }, [doc, level])

  return (
    <>
      {flights.map((flight) => (
        <Flight key={flight.id} {...flight} />
      ))}
    </>
  )
}

/**
 * How high the flight below is drawn: under this storey's floors, so they cover
 * it everywhere but in the well, and over the faint walls of the storey below,
 * which are further down still.
 */
const UNDERFOOT = 6

function Flight({
  id,
  spot,
  surface,
  size,
  drawing,
}: {
  id: string
  spot: { at: { x: number; y: number }; turn: number }
  surface: Parameters<typeof useSymbol>[1]
  size: { width: number; depth: number }
  drawing: { key: string; svg: string }
}) {
  const texture = useSymbol(drawing, surface, size)
  if (!texture) return null

  return (
    <mesh
      position={toWorld(spot.at.x, spot.at.y, UNDERFOOT)}
      // Laid flat and turned the way the flight faces, half round like every
      // other symbol so its top edge is the thing's back.
      rotation={[-Math.PI / 2, 0, spot.turn + Math.PI]}
      onClick={(event) => {
        if (dragged(event)) return
        event.stopPropagation()
        pick({ kind: 'object', id })
      }}
    >
      <planeGeometry args={[size.width * MM, size.depth * MM]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}
