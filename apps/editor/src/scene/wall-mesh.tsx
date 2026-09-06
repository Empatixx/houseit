import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { aimAt, putDown } from '../edit/draw-commands'
import { moveOpeningTo } from '../edit/opening-commands'
import { pick } from '../edit/pick'
import { endPreview } from '../edit/preview'
import {
  moveWallBy,
  previewStubResize,
  previewWallMove,
  resizeStub,
  stubOf,
} from '../edit/wall-commands'
import { EMPHASIS, type Emphasis, hoverStore, useHover } from '../store/hover'
import { usePreview } from '../store/preview'
import { useSelection } from '../store/selection'
import { toolStore } from '../store/tool'
import { dragged, pointOnPlan } from './drag'
import { MM, toWorld } from './plan-coordinates'
import { INK, planPieces } from './wall-pieces'

type WallMeshProps = {
  wall: Wall
  doc: HouseDocument
  degrees: Map<string, number>
  ofPickedRoom: boolean
}

export function WallMesh({ wall, doc, degrees, ofPickedRoom }: WallMeshProps) {
  const selected = useSelection((state) => state.selected)
  const hovered = useHover((state) => state.hovered)
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

  const held = carry.held
  let offset = { x: 0, y: 0 }
  if (held && held.id === wall.id && !previewing) {
    const shift = held.shift.x * across.x + held.shift.y * across.y
    offset = { x: across.x * shift, y: across.y * shift }
  }
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

  const tip = stub ? doc.nodes[stub.stub.tip] : undefined
  const tipDirection = stub && stub.stub.tip === wall.b ? unit : { x: -unit.x, y: -unit.y }

  return (
    <>
      {pieces.map((piece) => {
        const heldOpening = piece.opening !== undefined && held?.id === piece.opening
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
              if (dragged(event)) return
              event.stopPropagation()
              if (toolStore.getState().armed?.kind === 'wall') {
                putDown({ x: event.point.x / MM, y: -event.point.z / MM })
                return
              }
              pick(opening ? { kind: 'opening', id: opening.id } : { kind: 'wall', id: wall.id })
            }}
            onPointerDown={(event) => {
              if (toolStore.getState().armed?.kind === 'wall') return
              carry.down(event, opening ? opening.id : wall.id)
            }}
            onPointerMove={(event) => {
              if (toolStore.getState().armed?.kind === 'wall') {
                aimAt({ x: event.point.x / MM, y: -event.point.z / MM })
                return
              }
              const carried = carry.move(event)
              if (!carried || opening) return
              previewWallMove(wall, carried.shift)
            }}
            onPointerUp={(event) => {
              const carried = carry.up(event)
              endPreview()
              if (!carried) return
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

const pullStart: { current: Point | null } = { current: null }

function tinted(colour: string, emphasis: Emphasis | undefined): string {
  if (!emphasis) return colour
  const blues = EMPHASIS[emphasis]
  if (colour === INK.outline) return blues.line
  if (colour === INK.wall) return blues.fill
  if (colour === INK.glass) return blues.glass
  return colour
}

type Held = { id: string; from: Point; shift: Point }

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

  const hold = () => {
    if (controls) controls.enabled = false
  }
  const release = () => {
    if (controls) controls.enabled = true
  }

  return { held, down, move, up, hold, release }
}
