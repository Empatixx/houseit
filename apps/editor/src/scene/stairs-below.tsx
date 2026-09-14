import { levelBelow } from '@houseit/core/levels'
import { stairKind, stairShape, stairSymbol } from '@houseit/core/stairs'
import { surfaceOf } from '@houseit/core/surfaces'
import { roomsOf } from '@houseit/geometry/rooms'
import { standingAt } from '@houseit/geometry/standing'
import { useMemo } from 'react'
import { Euler, Matrix4 } from 'three'
import { pick } from '../edit/pick'
import { rectangleSheet } from '../engine/sheet-geometry'
import { useDocument, usePlanDoc } from '../store/store'
import { dragged } from './drag'
import { useSymbol } from './furniture/use-symbol'
import { PlanBody } from './plan-body'
import { toWorld } from './plan-coordinates'

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
    <PlanBody
      id={`below:object:${id}`}
      category="IFCFURNISHINGELEMENT"
      owner={{ kind: 'object', id }}
      input={rectangleSheet(size)}
      texture={texture}
      colour="#ffffff"
      transform={new Matrix4()
        .makeRotationFromEuler(new Euler(-Math.PI / 2, 0, spot.turn + Math.PI))
        .setPosition(...toWorld(spot.at.x, spot.at.y, UNDERFOOT))}
      onClick={(event) => {
        if (dragged(event)) return
        event.stopPropagation()
        pick({ kind: 'object', id })
      }}
    />
  )
}
