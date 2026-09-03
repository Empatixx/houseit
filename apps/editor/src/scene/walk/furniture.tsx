import type { HouseObject } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { symbolOf } from '@houseit/core/object-types'
import { type Surface, surfaceOf } from '@houseit/core/surfaces'
import { roomsOf } from '@houseit/geometry/rooms'
import { type Spot, standingAt } from '@houseit/geometry/standing'
import { useMemo } from 'react'
import { EMPHASIS } from '../../store/hover'
import { selectionStore, useSelection } from '../../store/selection'
import { useDocument, usePlanDoc } from '../../store/store'
import { dragged } from '../drag'
import { useSymbol } from '../furniture/use-symbol'
import { MM, toWorld } from '../plan-coordinates'

/**
 * The furniture, stood up: each thing is the box it takes up, as tall as its
 * type says, in its finish, with its plan symbol laid on top — so a sofa is a
 * sofa-coloured block the height of a sofa, and from anywhere above it the
 * drawing says which way it faces. Where it stands and which way it faces are
 * exactly the plan's, from the same `standingAt`.
 */
export function Furniture() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)

  const drawn = useMemo(() => {
    const rooms = new Map(
      roomsOf(doc, level)
        .filter((room) => room.id)
        .map((room) => [room.id!, room] as const),
    )
    return Object.values(doc.objects)
      .filter((object) => object.level === level)
      .flatMap((object) => {
        const room = rooms.get(object.room)
        const spot = room ? standingAt(doc, level, room, object) : undefined
        const surface = surfaceOf(object.surface)
        const symbol = symbolOf(object.type)
        if (!spot || !surface || !symbol) return []
        return [{ object, spot, surface, symbol }]
      })
  }, [doc, level])

  return (
    <>
      {drawn.map((entry) => (
        <Block key={entry.object.id} {...entry} />
      ))}
    </>
  )
}

type BlockProps = { object: HouseObject; spot: Spot; surface: Surface; symbol: string }

function Block({ object, spot, surface, symbol }: BlockProps) {
  const texture = useSymbol(symbol, surface, object)
  const picked = useSelection(
    (state) => state.selected?.kind === 'object' && state.selected.id === object.id,
  )
  const { height, base, glass } = heightOf(object.type)
  const colour = picked ? EMPHASIS.picked.tint : surface.fill

  return (
    // Turned the way it faces, as the plan turns its picture; the picture itself
    // is laid on top the same way it is laid in the plan, so its top is the back.
    <group position={toWorld(spot.at.x, spot.at.y, base)} rotation={[0, spot.turn, 0]}>
      <mesh
        position={[0, (height * MM) / 2, 0]}
        onClick={(event) => {
          if (dragged(event)) return
          event.stopPropagation()
          selectionStore.getState().select({ kind: 'object', id: object.id })
        }}
      >
        <boxGeometry args={[object.width * MM, height * MM, object.depth * MM]} />
        <meshLambertMaterial color={colour} transparent={glass} opacity={glass ? 0.35 : 1} />
      </mesh>
      {texture ? (
        <mesh position={[0, height * MM + 0.003, 0]} rotation={[-Math.PI / 2, 0, Math.PI]}>
          <planeGeometry args={[object.width * MM, object.depth * MM]} />
          <meshBasicMaterial
            map={texture}
            color={picked ? EMPHASIS.picked.tint : '#ffffff'}
            transparent
            alphaTest={0.02}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  )
}
