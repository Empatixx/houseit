import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { moveOpeningTo } from '../edit/opening-commands'
import { selectionStore } from '../store/selection'
import { dragged, pointOnPlan } from './drag'
import { MM, toWorld } from './plan-coordinates'
import { planPieces } from './wall-pieces'

type WallMeshProps = {
  wall: Wall
  doc: HouseDocument
  /** How many walls meet at each node, so free ends are not extended. */
  degrees: Map<string, number>
}

/**
 * One wall, drawn as a stack of boxes.
 *
 * Walls stop at the node they share, which leaves an empty square in every
 * corner. Each end that meets another wall is therefore extended by half the
 * thickness to fill it. Free ends are left alone — extending those would show as
 * a stub poking out of the plan.
 *
 * What the boxes are is `wall-pieces`. Which layer covers which is decided by
 * lifting one above another, because the plan is drawn from straight overhead:
 * there is no z-order to set, only height.
 *
 * The pieces of a door or a window can be picked, and carried: along the wall
 * while they are held, and when let go, wherever they were let go becomes one
 * `move-door` or `move-window` — which the plan may refuse.
 */
export function WallMesh({ wall, doc, degrees }: WallMeshProps) {
  const a = doc.nodes[wall.a]
  const b = doc.nodes[wall.b]
  const carry = useCarry()
  if (!a || !b) return null

  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy)
  if (span === 0) return null
  const unit = { x: dx / span, y: dy / span }

  const growA = (degrees.get(wall.a) ?? 0) > 1 ? wall.thickness / 2 : 0
  const growB = (degrees.get(wall.b) ?? 0) > 1 ? wall.thickness / 2 : 0
  const length = span + growA + growB

  const openings = Object.values(doc.openings).filter((opening) => opening.wall === wall.id)
  const pieces = planPieces(wall, openings, length, growA, span)
  const angle = Math.atan2(dy, dx)

  return (
    <>
      {pieces.map((piece) => {
        const held = piece.opening !== undefined && carry.held?.id === piece.opening
        // A held opening follows the pointer along its wall until it is let go.
        const slide = held ? carry.held!.shift.x * unit.x + carry.held!.shift.y * unit.y : 0
        const travelled = piece.at - growA + slide
        const aside = piece.aside ?? 0
        const x = a.x + (travelled * dx - aside * dy) / span
        const y = a.y + (travelled * dy + aside * dx) / span
        const base = wall.baseOffset + piece.base
        const opening = piece.opening === undefined ? undefined : doc.openings[piece.opening]
        const centre = opening ? { x: a.x + dx * opening.t, y: a.y + dy * opening.t } : undefined

        return (
          <mesh
            key={piece.key}
            position={toWorld(x, y, base + piece.height / 2)}
            rotation={[0, angle + (piece.turn ?? 0), 0]}
            onClick={
              opening
                ? (event) => {
                    if (dragged(event)) return
                    event.stopPropagation()
                    selectionStore.getState().select({ kind: 'opening', id: opening.id })
                  }
                : undefined
            }
            onPointerDown={opening ? (event) => carry.down(event, opening.id) : undefined}
            onPointerMove={opening ? carry.move : undefined}
            onPointerUp={
              opening && centre
                ? (event) => {
                    const shift = carry.up(event)
                    if (shift)
                      moveOpeningTo(opening, { x: centre.x + shift.x, y: centre.y + shift.y })
                  }
                : undefined
            }
          >
            <boxGeometry args={[piece.length * MM, piece.height * MM, piece.thickness * MM]} />
            <meshBasicMaterial
              color={piece.colour}
              transparent={held || piece.hidden}
              opacity={piece.hidden ? 0 : held ? 0.6 : 1}
              depthWrite={!piece.hidden}
            />
          </mesh>
        )
      })}
    </>
  )
}

/** An opening picked up: which, where the pointer took it, and how far it has come. */
type Held = { id: string; from: Point; shift: Point }

/**
 * Carrying an opening. The document is not touched while it is held; the
 * camera's own dragging is switched off, or the plan would pan under it.
 */
function useCarry() {
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const live = useRef<Held | null>(null)
  const [held, setHeld] = useState<Held | null>(null)

  const down = (event: ThreeEvent<PointerEvent>, id: string) => {
    if (event.button !== 0) return
    const from = pointOnPlan(event.ray)
    if (!from) return
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    live.current = { id, from, shift: { x: 0, y: 0 } }
    setHeld(live.current)
    if (controls) controls.enabled = false
  }

  const move = (event: ThreeEvent<PointerEvent>) => {
    const carried = live.current
    if (!carried) return
    const now = pointOnPlan(event.ray)
    if (!now) return
    live.current = { ...carried, shift: { x: now.x - carried.from.x, y: now.y - carried.from.y } }
    setHeld(live.current)
  }

  /** Lets go; the way it was carried, if it was carried rather than clicked. */
  const up = (event: ThreeEvent<PointerEvent>): Point | undefined => {
    const carried = live.current
    if (!carried) return undefined
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    live.current = null
    setHeld(null)
    if (controls) controls.enabled = true
    return Math.hypot(carried.shift.x, carried.shift.y) < 30 ? undefined : carried.shift
  }

  return { held, down, move, up }
}
