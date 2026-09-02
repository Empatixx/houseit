import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { moveOpeningTo } from '../edit/opening-commands'
import { endPreview } from '../edit/preview'
import { drawWallFrom, previewDrawnWall } from '../edit/shape-commands'
import {
  moveWallBy,
  previewStubResize,
  previewWallMove,
  resizeStub,
  stubOf,
} from '../edit/wall-commands'
import { EMPHASIS, type Emphasis, hoverStore, useHover } from '../store/hover'
import { usePreview } from '../store/preview'
import { selectionStore, useSelection } from '../store/selection'
import { toolStore, useTool } from '../store/tool'
import { dragged, pointOnPlan } from './drag'
import { MM, toWorld } from './plan-coordinates'
import { INK, planPieces } from './wall-pieces'

type WallMeshProps = {
  wall: Wall
  doc: HouseDocument
  /** How many walls meet at each node, so free ends are not extended. */
  degrees: Map<string, number>
  /** Whether the picked room is bounded by this wall, which turns it blue with the room. */
  ofPickedRoom: boolean
}

/** How thick a wall drawn by hand comes out, until it is a wall and can be changed. */
const DRAWN_THICKNESS = 150

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
 * Everything on a wall can be picked and carried, and moves as it is carried:
 * a door or a window along the wall, the wall across itself, the free end of a
 * stub along it. When let go, where it came to becomes one command — which
 * the plan may refuse, and then it is drawn back where it was. With the wall
 * tool armed, a drag off a wall draws a new wall into the room instead.
 */
export function WallMesh({ wall, doc, degrees, ofPickedRoom }: WallMeshProps) {
  const selected = useSelection((state) => state.selected)
  const hovered = useHover((state) => state.hovered)
  const armed = useTool((state) => state.armed)
  const carry = useCarry()
  const [pull, setPull] = useState(0)
  const previewing = usePreview((state) => state.doc !== null)
  const a0 = doc.nodes[wall.a]
  const b0 = doc.nodes[wall.b]

  const picked = selected?.kind === 'wall' && selected.id === wall.id
  const stub = useMemo(() => (picked ? stubOf(wall) : undefined), [picked, wall])
  if (!a0 || !b0) return null

  const span0 = Math.hypot(b0.x - a0.x, b0.y - a0.y)
  if (span0 === 0) return null
  const unit = { x: (b0.x - a0.x) / span0, y: (b0.y - a0.y) / span0 }
  const across = { x: -unit.y, y: unit.x }

  // Carried across itself, the whole wall moves with the pointer — and with
  // it the rooms either side, drawn from the preview; only where the plan
  // refuses the move does the wall alone follow, so the hand still sees it.
  const held = carry.held
  const drawing = armed?.kind === 'wall'
  let offset = { x: 0, y: 0 }
  if (held && held.id === wall.id && !drawing && !previewing) {
    const shift = held.shift.x * across.x + held.shift.y * across.y
    offset = { x: across.x * shift, y: across.y * shift }
  }
  // A stub's free end pulled along the wall makes the wall that much longer, live.
  let a = { x: a0.x + offset.x, y: a0.y + offset.y }
  let b = { x: b0.x + offset.x, y: b0.y + offset.y }
  if (pull !== 0 && stub && !previewing) {
    if (stub.stub.tip === wall.b) b = { x: b.x + unit.x * pull, y: b.y + unit.y * pull }
    else a = { x: a.x - unit.x * pull, y: a.y - unit.y * pull }
  }

  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy)
  const growA = (degrees.get(wall.a) ?? 0) > 1 ? wall.thickness / 2 : 0
  const growB = (degrees.get(wall.b) ?? 0) > 1 ? wall.thickness / 2 : 0
  const length = span + growA + growB

  const openings = Object.values(doc.openings).filter((opening) => opening.wall === wall.id)
  const pieces = planPieces(wall, openings, length, growA, span)
  const angle = Math.atan2(dy, dx)

  const wallEmphasis: Emphasis | undefined =
    picked || ofPickedRoom
      ? 'picked'
      : hovered?.kind === 'wall' && hovered.id === wall.id
        ? 'hovered'
        : undefined
  const emphasisOf = (openingId: string | undefined): Emphasis | undefined => {
    if (openingId === undefined) return wallEmphasis
    if (selected?.kind === 'opening' && selected.id === openingId) return 'picked'
    if (hovered?.kind === 'opening' && hovered.id === openingId) return 'hovered'
    return wallEmphasis
  }

  // The tip of a picked stub, for the handle that pulls it.
  const tip = stub ? doc.nodes[stub.stub.tip] : undefined
  const tipDirection = stub && stub.stub.tip === wall.b ? unit : { x: -unit.x, y: -unit.y }

  return (
    <>
      {pieces.map((piece) => {
        const heldOpening = piece.opening !== undefined && held?.id === piece.opening
        // A held opening follows the pointer along its wall until it is let go.
        const slide = heldOpening ? held!.shift.x * unit.x + held!.shift.y * unit.y : 0
        const travelled = piece.at - growA + slide
        const aside = piece.aside ?? 0
        const x = a.x + (travelled * dx - aside * dy) / span
        const y = a.y + (travelled * dy + aside * dx) / span
        const base = wall.baseOffset + piece.base
        const opening = piece.opening === undefined ? undefined : doc.openings[piece.opening]
        const centre = opening
          ? { x: a0.x + (b0.x - a0.x) * opening.t, y: a0.y + (b0.y - a0.y) * opening.t }
          : undefined
        const emphasis = emphasisOf(piece.opening)

        return (
          <mesh
            key={piece.key}
            position={toWorld(x, y, base + piece.height / 2)}
            rotation={[0, angle + (piece.turn ?? 0), 0]}
            onPointerOver={(event) => {
              event.stopPropagation()
              hoverStore
                .getState()
                .hover(
                  opening ? { kind: 'opening', id: opening.id } : { kind: 'wall', id: wall.id },
                )
            }}
            onPointerOut={() => hoverStore.getState().hover(null)}
            onClick={(event) => {
              if (dragged(event) || toolStore.getState().armed?.kind === 'wall') return
              event.stopPropagation()
              selectionStore
                .getState()
                .select(
                  opening ? { kind: 'opening', id: opening.id } : { kind: 'wall', id: wall.id },
                )
            }}
            onPointerDown={(event) => carry.down(event, opening ? opening.id : wall.id)}
            onPointerMove={(event) => {
              const carried = carry.move(event)
              if (!carried || opening) return
              // The rooms follow the wall as it is carried: what the drop would
              // do, drawn as the pointer goes.
              if (toolStore.getState().armed?.kind === 'wall') {
                previewDrawnWall(wall, carried.from, carried.shift)
              } else {
                previewWallMove(wall, carried.shift)
              }
            }}
            onPointerUp={(event) => {
              const carried = carry.up(event)
              endPreview()
              if (!carried) return
              // With the wall tool armed, a drag off a wall draws a new wall
              // into the room rather than moving anything.
              if (toolStore.getState().armed?.kind === 'wall') {
                if (drawWallFrom(wall, carried.from, carried.shift)) toolStore.getState().arm(null)
                return
              }
              const { shift } = carried
              if (opening && centre) {
                moveOpeningTo(opening, { x: centre.x + shift.x, y: centre.y + shift.y })
              } else if (!opening) {
                moveWallBy(wall, shift)
              }
            }}
          >
            <boxGeometry args={[piece.length * MM, piece.height * MM, piece.thickness * MM]} />
            <meshBasicMaterial
              color={tinted(piece.colour, emphasis)}
              transparent={piece.hidden}
              opacity={piece.hidden ? 0 : 1}
              depthWrite={!piece.hidden}
            />
          </mesh>
        )
      })}

      {held && held.id === wall.id && drawing && !previewing ? (
        // The wall being drawn: from where the drag began, across the wall's
        // line, as far as the pointer has gone that way.
        <DrawnWall from={held.from} along={across} shift={held.shift} height={wall.height} />
      ) : null}

      {picked && stub && tip ? (
        <mesh
          position={toWorld(
            tip.x + tipDirection.x * pull,
            tip.y + tipDirection.y * pull,
            wall.height + 60,
          )}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.stopPropagation()
            ;(event.target as Element).setPointerCapture(event.pointerId)
            carry.hold()
            const from = pointOnPlan(event.ray)
            if (from) pullStart.current = from
          }}
          onPointerMove={(event) => {
            const from = pullStart.current
            if (!from) return
            const now = pointOnPlan(event.ray)
            if (!now) return
            const pulled = (now.x - from.x) * tipDirection.x + (now.y - from.y) * tipDirection.y
            setPull(pulled)
            previewStubResize(wall, stub.stub.length + pulled)
          }}
          onPointerUp={(event) => {
            if (!pullStart.current) return
            ;(event.target as Element).releasePointerCapture(event.pointerId)
            pullStart.current = null
            carry.release()
            const change = pull
            setPull(0)
            endPreview()
            if (Math.abs(change) >= 30) resizeStub(wall, stub.stub.length + change)
          }}
        >
          <boxGeometry args={[0.22, 0.05, 0.22]} />
          <meshBasicMaterial color={EMPHASIS.picked.line} />
        </mesh>
      ) : null}
    </>
  )
}

/** Where the pointer took hold of a stub's free end, while it is held. */
const pullStart: { current: Point | null } = { current: null }

/** A wall's colours, gone blue for what is picked or under the pointer. */
function tinted(colour: string, emphasis: Emphasis | undefined): string {
  if (!emphasis) return colour
  const blues = EMPHASIS[emphasis]
  if (colour === INK.outline) return blues.line
  if (colour === INK.wall) return blues.fill
  if (colour === INK.glass) return blues.glass
  return colour
}

/** The wall the wall tool is drawing, live: a bold blue box from the start to the pointer. */
function DrawnWall({
  from,
  along,
  shift,
  height,
}: {
  from: Point
  along: Point
  shift: Point
  height: number
}) {
  const reach = shift.x * along.x + shift.y * along.y
  if (Math.abs(reach) < 30) return null
  const to = { x: from.x + along.x * reach, y: from.y + along.y * reach }
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  return (
    <mesh
      position={toWorld(middle.x, middle.y, height / 2 + 20)}
      rotation={[0, Math.atan2(to.y - from.y, to.x - from.x), 0]}
    >
      <boxGeometry args={[Math.abs(reach) * MM, height * MM, DRAWN_THICKNESS * MM]} />
      <meshBasicMaterial color={EMPHASIS.picked.line} />
    </mesh>
  )
}

/** Something on the wall picked up: which, where the pointer took it, and how far it has come. */
type Held = { id: string; from: Point; shift: Point }

/**
 * Carrying a door, a window or the wall itself. The document is not touched
 * while it is held; the camera's own dragging is switched off, or the plan
 * would pan under it.
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

  const move = (event: ThreeEvent<PointerEvent>): Held | undefined => {
    const carried = live.current
    if (!carried) return undefined
    const now = pointOnPlan(event.ray)
    if (!now) return carried
    live.current = { ...carried, shift: { x: now.x - carried.from.x, y: now.y - carried.from.y } }
    setHeld(live.current)
    return live.current
  }

  /** Lets go; where it was picked up and how far it was carried, if carried rather than clicked. */
  const up = (event: ThreeEvent<PointerEvent>): { from: Point; shift: Point } | undefined => {
    const carried = live.current
    if (!carried) return undefined
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    live.current = null
    setHeld(null)
    if (controls) controls.enabled = true
    if (Math.hypot(carried.shift.x, carried.shift.y) < 30) return undefined
    return { from: carried.from, shift: carried.shift }
  }

  /** Something else takes the pointer for a while: the camera keeps still meanwhile. */
  const hold = () => {
    if (controls) controls.enabled = false
  }
  const release = () => {
    if (controls) controls.enabled = true
  }

  return { held, down, move, up, hold, release }
}
