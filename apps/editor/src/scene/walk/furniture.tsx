import type { HouseObject } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { layerOf, symbolOf } from '@houseit/core/object-types'
import { isStaircase } from '@houseit/core/stairs'
import { type Surface, surfaceOf } from '@houseit/core/surfaces'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { footprintOf, type Spot, standingAt } from '@houseit/geometry/standing'
import { useMemo } from 'react'
import { pick } from '../../edit/pick'
import { EMPHASIS } from '../../store/hover'
import { useSelection } from '../../store/selection'
import { usePlanDoc } from '../../store/store'
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
export function Furniture({ level }: { level: string }) {
  const doc = usePlanDoc()

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
        if (!spot || !surface) return []
        // A staircase has no symbol to stamp — it is drawn, and here it is
        // built. Asking for one dropped every flight in the house out of the
        // 3D, which is why an upper storey had a hole in it and nothing coming
        // up through the hole.
        const symbol = symbolOf(object.type) ?? ''
        if (!symbol && !modelled(object.type)) return []
        return [{ object, spot, surface, symbol }]
      })
    // A lamp on a table stands on the table: what is on the layer above the
    // furniture rests on the top of whatever furniture is under its middle.
    return standing.map((entry) => ({ ...entry, rest: restOf(entry, standing) }))
  }, [doc, level])

  const storey = doc.levels[level]

  return (
    <>
      {drawn.map((entry) => (
        <Block
          key={entry.object.id}
          {...entry}
          climb={isStaircase(entry.object.type) ? storey?.height : undefined}
        />
      ))}
    </>
  )
}

type Standing = { object: HouseObject; spot: Spot; surface: Surface; symbol: string }
type BlockProps = Standing & { rest: number; climb?: number }

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

function Block({ object, spot, surface, symbol, rest, climb }: BlockProps) {
  const has = modelled(object.type)
  const texture = useSymbol(has ? '' : symbol, surface, object)
  const picked = useSelection(
    (state) => state.selected?.kind === 'object' && state.selected.id === object.id,
  )
  const stands = heightOf(object.type)
  // A staircase is as tall as the storey it climbs. Everything else is as tall
  // as the catalogue says, but a flight that stopped at the catalogue's height
  // would be a flight to nowhere — the one number it cannot be given in advance
  // is the one that decides where its top step is.
  const height = climb ?? stands.height
  const { glass } = stands
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
