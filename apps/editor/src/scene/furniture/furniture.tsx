import { type Layer, layerOf } from '@houseit/core/object-types'
import { type Surface, surfaceOf } from '@houseit/core/surfaces'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { type Spot, standingAt } from '@houseit/geometry/standing'
import { useMemo } from 'react'
import { ShapeGeometry } from 'three'
import { useDocument } from '../../store/store'
import { MM, toWorld } from '../plan-coordinates'
import { LINE, modelled, outlineAndFill, RIM } from './shapes'
import { type Part, skeletonOf } from './skeleton'
import { planHeight, SHADOW, shadowHeight } from './stacking'
import { surfaceTexture } from './surface-texture'

/**
 * What a mesh is coloured. A pattern is tinted by the surface's own colour, so
 * one weave can be grey or blue; a picture of a material carries its own colours
 * and is left alone.
 */
const ink = (surface: Surface, tone: Part['tone']) => {
  const base = surface.texture && !surface.tint ? '#ffffff' : surface.fill
  if (tone === 'dark') return darken(base, 0.22)
  if (tone === 'light') return darken(base, -0.28)
  return base
}

/**
 * A shade off a colour, kept in the renderer because it is a matter of drawing.
 * A negative amount lightens, which is how a thrown cushion is picked out from
 * the sofa under it without either of them being given a colour of its own.
 */
function darken(colour: string, amount: number): string {
  const channel = (at: number) => {
    const value = Number.parseInt(colour.slice(at, at + 2), 16)
    const shifted = amount < 0 ? value + (255 - value) * -amount : value * (1 - amount)
    return Math.round(Math.max(0, Math.min(255, shifted)))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(1)}${channel(3)}${channel(5)}`
}

/**
 * The furniture, drawn from the plan or built from the model.
 *
 * Seen from overhead, so a skeleton's parts are flat shapes stacked such that a
 * top covers what is tucked under it. The parts a plan never shows — a table's
 * legs, a round table's foot — stay in the skeleton and are filtered out here,
 * because they are what the thing is and not merely how it is drawn.
 *
 * Nothing is stored in world coordinates. An object knows its room, which side it
 * backs onto and how far along, and that becomes a place on screen from the room
 * as it stands now — so moving a partition moves the furniture with it.
 */
export function Furniture() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)

  const drawn = useMemo(() => {
    const rooms = new Map(
      roomsOf(doc, level)
        .filter((room) => room.id)
        .map((room) => [room.id!, room] as const),
    )

    return Object.values(doc.objects)
      .filter((object) => object.level === level)
      .flatMap((object, order) => {
        const room = rooms.get(object.room)
        const spot = room ? standingAt(doc, level, room, object) : undefined
        const surface = surfaceOf(object.surface)
        if (!spot || !surface) return []

        const stack = { layer: layerOf(object.type), index: order }
        return (
          skeletonOf(object)
            .filter((part) => (part.show ?? 'both') !== 'model')
            // A part may be finished in something other than the object it belongs
            // to — the ceramic basin in a walnut vanity — and says so by name.
            .map((part) => ({
              object,
              spot,
              surface: (part.surface ? surfaceOf(part.surface) : undefined) ?? surface,
              part,
              stack,
            }))
        )
      })
  }, [doc, level])

  return (
    <>
      {drawn.map(({ object, spot, surface, part, stack }) => (
        <Flat
          key={`${object.id}-${part.key}`}
          spot={spot}
          surface={surface}
          part={part}
          stack={stack}
        />
      ))}
    </>
  )
}

type FlatProps = {
  spot: Spot
  surface: Surface
  part: Part
  stack: { layer: Layer; index: number }
}

/** Seen from overhead: the shape, with its own edge showing round it and a shadow under it. */
function Flat({ spot, surface, part, stack }: FlatProps) {
  const { outline, fill } = useMemo(() => outlineAndFill(part), [part])
  const geometry = useMemo(
    () => ({ outline: new ShapeGeometry(outline), fill: new ShapeGeometry(fill) }),
    [outline, fill],
  )
  const at = place(spot, part)
  const texture = part.plain ? undefined : surfaceTexture(surface)
  const turn = spot.turn + (part.turn ?? 0)
  const line = (part.paint ?? 'fill') === 'line'
  // A line takes its own shade too, or a mark meant to read as light drawn on a
  // dark one comes out the very same colour as the shadow beside it.
  const edge =
    part.tone === 'dark'
      ? darken(surface.line, 0.2)
      : part.tone === 'light'
        ? darken(surface.line, -0.55)
        : surface.line

  return (
    <>
      {line ? null : (
        <group
          position={toWorld(at.x + SHADOW.x, at.y + SHADOW.y, shadowHeight(stack))}
          rotation={[0, turn, 0]}
        >
          <mesh geometry={geometry.outline} rotation={[-Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color="#000000" transparent opacity={0.12} depthWrite={false} />
          </mesh>
        </group>
      )}
      <group position={toWorld(at.x, at.y, planHeight(part, stack))} rotation={[0, turn, 0]}>
        <mesh geometry={geometry.outline} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={edge} />
        </mesh>
        {line || part.relief ? null : (
          <mesh geometry={geometry.fill} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <meshBasicMaterial color={ink(surface, part.tone)} map={texture ?? null} />
          </mesh>
        )}
        {part.relief ? <Modelled part={part} colour={ink(surface, part.tone)} /> : null}
        {ribsOf(part).map((rib) => (
          <mesh
            key={rib.key}
            position={[rib.x * MM, 0.004, -rib.y * MM]}
            rotation={[0, rib.turn, 0]}
          >
            <boxGeometry args={[LINE * 0.7 * MM, 0.001, rib.length * MM]} />
            <meshBasicMaterial color={edge} />
          </mesh>
        ))}
      </group>
    </>
  )
}

/**
 * A part with a modelled edge: lit along one side, shaded along the other, all of
 * it inside the part's own outline.
 *
 * Three flat shapes, each one further in than the last. The lit one fills the
 * part; the shaded one is pulled in and pushed towards the light, so what stays
 * showing of the lit shape is a band on the side facing it; the middle carries the
 * real colour and leaves a band of the shaded one on the far side.
 */
function Modelled({ part, colour }: { part: Part; colour: string }) {
  const shapes = useMemo(() => modelled(part), [part])
  const geometry = useMemo(
    () => ({
      lit: new ShapeGeometry(shapes.lit),
      shaded: new ShapeGeometry(shapes.shaded),
      middle: new ShapeGeometry(shapes.middle),
    }),
    [shapes],
  )
  const towards = RIM * MM

  return (
    <>
      <mesh geometry={geometry.lit} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <meshBasicMaterial color={darken(colour, -0.4)} />
      </mesh>
      <mesh
        geometry={geometry.shaded}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[towards, 0.003, towards]}
      >
        <meshBasicMaterial color={darken(colour, 0.22)} />
      </mesh>
      <mesh geometry={geometry.middle} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <meshBasicMaterial color={colour} />
      </mesh>
    </>
  )
}

/** The ribs across a chair's back, drawn on top of it. A plan convention only. */
function ribsOf(part: Part): { key: string; x: number; y: number; turn: number; length: number }[] {
  if (part.kind !== 'band' || !part.spokes) return []

  const ribs = []
  for (let i = 1; i < part.spokes; i += 1) {
    const angle = Math.PI + (Math.PI * i) / part.spokes
    const reach = { x: (Math.cos(angle) * part.width) / 2, y: Math.sin(angle) * part.depth }
    ribs.push({
      key: `${part.key}-rib-${i}`,
      x: reach.x / 2,
      y: reach.y / 2,
      turn: Math.atan2(reach.x, -reach.y),
      length: Math.max(1, Math.hypot(reach.x, reach.y) - (part.wall ?? 40)),
    })
  }
  return ribs
}

const place = (spot: Spot, part: Part): Point => ({
  x: spot.at.x + part.x * Math.cos(spot.turn) - part.y * Math.sin(spot.turn),
  y: spot.at.y + part.x * Math.sin(spot.turn) + part.y * Math.cos(spot.turn),
})
