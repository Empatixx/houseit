import { levelBelow } from '@houseit/core/levels'
import { elementId } from '@houseit/geometry/wall-elements'
import { useMemo } from 'react'
import { Matrix4 } from 'three'
import { useDocument, usePlanDoc } from '../store/store'
import { PlanBody } from './plan-body'
import { MM } from './plan-coordinates'

export function StoreyBelow() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)

  const walls = useMemo(() => {
    const under = levelBelow(doc, level)
    if (!under) return []
    return Object.values(doc.walls)
      .filter((wall) => wall.level === under.id)
      .flatMap((wall) => {
        const a = doc.nodes[wall.a]
        const b = doc.nodes[wall.b]
        if (!a || !b) return []
        return [
          {
            id: wall.id,
            entity: `elements:${elementId(wall)}`,
            middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            length: Math.hypot(b.x - a.x, b.y - a.y),
            thickness: wall.thickness,
            turn: Math.atan2(b.x - a.x, b.y - a.y),
          },
        ]
      })
  }, [doc, level])

  return (
    <>
      {walls.map((wall) => (
        <PlanBody
          key={wall.id}
          id={`below:wall:${wall.id}`}
          entity={wall.entity}
          category="HOUSEITREFERENCE"
          input={{
            kind: 'primitive',
            body: { kind: 'box', width: wall.thickness, height: 1, depth: wall.length },
          }}
          transform={new Matrix4()
            .makeRotationY(wall.turn)
            .setPosition(wall.middle.x * MM, 0.004, -wall.middle.y * MM)}
          colour="#0f172a"
          opacity={0.12}
        />
      ))}
    </>
  )
}
