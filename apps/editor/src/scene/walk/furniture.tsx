import type { HouseObject } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { layerOf, symbolOf } from '@houseit/core/object-types'
import { type Surface, surfaceOf } from '@houseit/core/surfaces'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { footprintOf, type Spot, standingAt } from '@houseit/geometry/standing'
import { useMemo } from 'react'
import { pick } from '../../edit/pick'
import { EMPHASIS } from '../../store/hover'
import { useSelection } from '../../store/selection'
import { useDocument, usePlanDoc } from '../../store/store'
import { dragged } from '../drag'
import { useSymbol } from '../furniture/use-symbol'
import { MM, toWorld } from '../plan-coordinates'
import { paintOf } from './finish'
import { Model, modelled } from './models'

/**
 * The furniture, stood up. A type with a model is built from it — a bed is a
 * bed, a kitchen a run of cabinets under a worktop — in its finish, with the
 * wood and stone finishes borrowing the floor photographs for their grain.
 * A type without one is the box it takes up, as tall as its type says, with
 * its plan symbol laid on top so it still reads. Where a thing stands and
 * which way it faces are exactly the plan's, from the same `standingAt`.
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
    const standing = Object.values(doc.objects)
      .filter((object) => object.level === level)
      .flatMap((object) => {
        const room = rooms.get(object.room)
        const spot = room ? standingAt(doc, level, room, object) : undefined
        const surface = surfaceOf(object.surface)
        const symbol = symbolOf(object.type)
        if (!spot || !surface || !symbol) return []
        return [{ object, spot, surface, symbol }]
      })
    // A lamp on a table stands on the table: what is on the layer above the
    // furniture rests on the top of whatever furniture is under its middle.
    return standing.map((entry) => ({ ...entry, rest: restOf(entry, standing) }))
  }, [doc, level])

  return (
    <>
      {drawn.map((entry) => (
        <Block key={entry.object.id} {...entry} />
      ))}
    </>
  )
}

type Standing = { object: HouseObject; spot: Spot; surface: Surface; symbol: string }
type BlockProps = Standing & { rest: number }

/** How high a thing on the layer above the furniture rests: the top of what is under it, or the floor. */
function restOf(thing: Standing, all: Standing[]): number {
  if (layerOf(thing.object.type) !== 'over') return 0
  let top = 0
  for (const other of all) {
    if (other === thing || layerOf(other.object.type) !== 'floor') continue
    if (other.object.room !== thing.object.room) continue
    const under = footprintOf(other.spot, other.object)
    if (!containsPoint(under, thing.spot.at.x, thing.spot.at.y)) continue
    const stands = heightOf(other.object.type)
    top = Math.max(top, stands.base + stands.height)
  }
  return top
}

function Block({ object, spot, surface, symbol, rest }: BlockProps) {
  const has = modelled(object.type)
  const texture = useSymbol(has ? '' : symbol, surface, object)
  const picked = useSelection(
    (state) => state.selected?.kind === 'object' && state.selected.id === object.id,
  )
  const stands = heightOf(object.type)
  const { height, glass } = stands
  // On what is under it where there is something; otherwise where its type says.
  const base = rest > 0 ? rest : stands.base
  const paints = paintOf(surface)

  return (
    // Turned the way it faces, as the plan turns its picture; the picture itself
    // is laid on top the same way it is laid in the plan, so its top is the back.
    <group position={toWorld(spot.at.x, spot.at.y, base)} rotation={[0, spot.turn, 0]}>
      {/* What takes the click: the box the thing takes up, unseen where there is a model. */}
      <mesh
        position={[0, (height * MM) / 2, 0]}
        onClick={(event) => {
          if (dragged(event)) return
          event.stopPropagation()
          pick({ kind: 'object', id: object.id })
        }}
      >
        <boxGeometry args={[object.width * MM, height * MM, object.depth * MM]} />
        <meshLambertMaterial
          color={picked ? EMPHASIS.picked.tint : surface.fill}
          transparent={has || picked || glass}
          opacity={has ? (picked ? 0.35 : 0) : glass ? 0.35 : 1}
          depthWrite={!has && !glass}
        />
      </mesh>
      {has ? (
        <Model
          type={object.type}
          part={{
            w: object.width,
            d: object.depth,
            h: height,
            body: paints.body,
            frame: paints.frame,
          }}
        />
      ) : null}
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
