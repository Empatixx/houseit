import type { HouseObject } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { CAMERA, layerOf, symbolOf } from '@houseit/core/object-types'
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

export function Furniture({ level }: { level: string }) {
  const doc = usePlanDoc()

  const drawn = useMemo(() => {
    const rooms = new Map(
      roomsOf(doc, level)
        .filter((room) => room.id)
        .map((room) => [room.id!, room] as const),
    )
    const standing = Object.values(doc.objects)
      .filter((object) => object.level === level && object.type !== CAMERA)
      .flatMap((object) => {
        const room = rooms.get(object.room)
        const spot = room ? standingAt(doc, level, room, object) : undefined
        const surface = surfaceOf(object.surface)
        if (!spot || !surface) return []
        const symbol = symbolOf(object.type) ?? ''
        if (!symbol && !modelled(object.type)) return []
        return [{ object, spot, surface, symbol }]
      })
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
  const height = climb ?? stands.height
  const { glass } = stands
  const base = rest > 0 ? rest : stands.base
  const paints = paintOf(surface)

  return (
    <group position={toWorld(spot.at.x, spot.at.y, base)} rotation={[0, spot.turn, 0]}>
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
