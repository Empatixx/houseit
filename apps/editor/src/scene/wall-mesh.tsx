import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { wallCaps } from '@houseit/geometry/wall-caps'
import { elementId, wallElement } from '@houseit/geometry/wall-elements'
import { INK, planPieces, type WallPiece } from '@houseit/scene/wall-pieces'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, OrthographicCamera } from 'three'
import { aimAt, putDown } from '../edit/draw-commands'
import { moveOpeningTo } from '../edit/opening-commands'
import { pick } from '../edit/pick'
import { endPreview } from '../edit/preview'
import { moveWallBy, previewWallMove, previewWallResize, resizeWall } from '../edit/wall-commands'
import { activeTools } from '../engine/native-tools'
import { useWallGeometry } from '../engine/use-wall-geometry'
import { wallBody } from '../engine/wall-body'
import { engineViewStore } from '../store/engine-view'
import { EMPHASIS, type Emphasis, hoverStore, useHover } from '../store/hover'
import { usePreview } from '../store/preview'
import { useSelection } from '../store/selection'
import { documentStore } from '../store/store'
import { toolStore, useTool } from '../store/tool'
import { dragged, pointOnPlan, pointUnder } from './drag'
import { usePlain } from './plain'
import { MM, toWorld } from './plan-coordinates'

type WallMeshProps = {
  wall: Wall
  outside?: 1 | -1 | undefined
  doc: HouseDocument
  ofPickedRoom: boolean
  pickedRoom?: string
}

export function WallMesh({ wall, doc, ofPickedRoom, pickedRoom, outside }: WallMeshProps) {
  const body = useMemo(() => wallBody(doc, wall, true), [doc, wall])
  const geometry = useWallGeometry(body)
  const plainly = usePlain()
  const chosen = useSelection((state) => state.selected)
  const noticed = useHover((state) => state.hovered)
  const selected = plainly ? null : chosen
  const hovered = plainly ? null : noticed
  const carry = useCarry()
  const previewing = usePreview((state) => state.doc !== null)
  const drawing = useTool((state) => state.armed?.kind === 'wall')
  const a0 = doc.nodes[wall.a]
  const b0 = doc.nodes[wall.b]

  const selectedWall = selected?.kind === 'wall' ? doc.walls[selected.id] : undefined
  const picked =
    selectedWall !== undefined &&
    (selectedWall.element ?? selectedWall.id) === (wall.element ?? wall.id)
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
  const a = { x: a0.x + offset.x, y: a0.y + offset.y }
  const b = { x: b0.x + offset.x, y: b0.y + offset.y }

  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy)
  const { growA, growB } = wallCaps(doc, wall)
  const length = span + growA + growB

  const openings = Object.values(doc.openings).filter((opening) => opening.wall === wall.id)
  const pieces: WallPiece[] = [
    {
      key: 'native-wall',
      colour: INK.wall,
      at: growA,
      length: span,
      thickness: wall.thickness,
      base: 0,
      height: 0,
    },
    ...planPieces(wall, openings, length, growA, span, outside).filter(
      (p) => !p.key.startsWith('outline-') && !p.key.startsWith('fill-'),
    ),
  ]
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

  const element = picked ? wallElement(doc, wall.id) : undefined
  const freeEnds =
    element && selectedWall?.id === wall.id
      ? (['from', 'to'] as const).filter(
          (end) =>
            !Object.values(doc.walls).some(
              (other) =>
                elementId(other) !== element.id &&
                (other.a === element[end].id || other.b === element[end].id),
            ),
        )
      : []

  return (
    <>
      {pieces.map((piece) => {
        const native = piece.key === 'native-wall'
        if (native && !geometry) return null
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
            userData={{
              houseit: opening
                ? { kind: 'opening', id: opening.id }
                : { kind: 'wall', id: wall.id },
              houseitHelper: !!piece.hidden,
            }}
            geometry={native ? geometry! : undefined}
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
              if (
                engineViewStore.getState().measure !== 'none' ||
                toolStore.getState().armed ||
                event.button !== 0
              )
                return
              if (!opening) {
                pick({ kind: 'wall', id: wall.id })
                carry.down(
                  event,
                  wall.id,
                  (carried) => {
                    endPreview()
                    if (carried) moveWallBy(wall, carried.shift)
                  },
                  (carried) => previewWallMove(wall, carried.shift),
                )
                return
              }
              pick({ kind: 'opening', id: opening.id })
              carry.down(event, opening.id, (carried) => {
                if (!carried || !centre) return
                moveOpeningTo(opening, {
                  x: centre.x + carried.shift.x,
                  y: centre.y + carried.shift.y,
                })
              })
            }}
            onPointerMove={(event) => {
              if (toolStore.getState().armed?.kind === 'wall') {
                aimAt({ x: event.point.x / MM, y: -event.point.z / MM })
              }
            }}
          >
            {native ? null : (
              <boxGeometry args={[piece.length * MM, piece.height * MM, piece.thickness * MM]} />
            )}
            <meshBasicMaterial
              color={tinted(piece, emphasis)}
              transparent={piece.hidden}
              opacity={piece.hidden ? 0 : 1}
              depthWrite={!piece.hidden}
            />
          </mesh>
        )
      })}

      {((picked && selectedWall?.id === wall.id) || ofPickedRoom) && !drawing ? (
        <Knob
          at={{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }}
          height={wall.baseOffset + wall.height + 60}
          onDown={(event) =>
            carry.down(
              event,
              wall.id,
              (carried) => {
                endPreview()
                if (carried) moveWallBy(wall, carried.shift, ofPickedRoom ? pickedRoom : undefined)
              },
              (carried) =>
                previewWallMove(wall, carried.shift, ofPickedRoom ? pickedRoom : undefined),
            )
          }
        />
      ) : null}

      {element && !drawing
        ? freeEnds.map((end) => (
            <Knob
              key={end}
              at={element[end]}
              height={wall.baseOffset + wall.height + 60}
              square
              onDown={(event) => {
                const direction = end === 'to' ? 1 : -1
                const lengthAt = (shift: Point) =>
                  element.length + direction * (shift.x * element.unit.x + shift.y * element.unit.y)
                carry.down(
                  event,
                  wall.id,
                  (carried) => {
                    endPreview()
                    if (carried) resizeWall(wall, end, lengthAt(carried.shift))
                  },
                  (carried) => previewWallResize(wall, end, lengthAt(carried.shift)),
                )
              }}
            />
          ))
        : null}
    </>
  )
}

const KNOB = 7

type KnobProps = {
  at: Point
  height: number
  onDown: (event: ThreeEvent<PointerEvent>) => void
  square?: boolean
}

function Knob({ at, height, onDown, square = false }: KnobProps) {
  const group = useRef<Group>(null)
  useFrame(({ camera }) => {
    group.current?.scale.setScalar(KNOB / (camera as OrthographicCamera).zoom)
  })
  return (
    <group
      ref={group}
      position={toWorld(at.x, at.y, height)}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={onDown}
      onClick={(event) => event.stopPropagation()}
    >
      <mesh>
        {square ? <planeGeometry args={[1.6, 1.6]} /> : <circleGeometry args={[1, 24]} />}
        <meshBasicMaterial color={INK.outline} depthTest={false} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        {square ? <planeGeometry args={[1.1, 1.1]} /> : <circleGeometry args={[0.72, 24]} />}
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
    </group>
  )
}

function tinted(piece: WallPiece, emphasis: Emphasis | undefined): string {
  if (!emphasis) return piece.colour
  const blues = EMPHASIS[emphasis]
  if (piece.key.startsWith('fill-')) return blues.fill
  if (piece.colour === INK.glass) return blues.glass
  return blues.line
}

type Held = { id: string; from: Point; shift: Point }

function useCarry() {
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)
  const live = useRef<Held | null>(null)
  const [held, setHeld] = useState<Held | null>(null)

  const letGo = useRef<(() => void) | null>(null)

  useEffect(() => () => letGo.current?.(), [])

  const down = (
    event: ThreeEvent<PointerEvent>,
    id: string,
    end?: (carried: { from: Point; shift: Point } | undefined) => void,
    onward?: (carried: Held) => void,
  ) => {
    if (event.button !== 0 || engineViewStore.getState().measure !== 'none') return
    const from = pointOnPlan(event.ray)
    if (!from) return
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    live.current = { id, from, shift: { x: 0, y: 0 } }
    setHeld(live.current)
    if (controls) controls.enabled = false

    let pending = Promise.resolve()
    let sequence = 0
    const follow = (native: PointerEvent) => {
      const request = ++sequence
      const carried = live.current
      if (!carried) return
      const now = pointUnder(native, canvas, camera)
      if (!now) return
      pending = (async () => {
        const snap = await activeTools?.snapPoint(now, {
          kind: documentStore.getState().doc.openings[id] ? 'opening' : 'wall',
          id,
        })
        if (request !== sequence || !live.current) return
        const point = snap ?? now
        live.current = {
          ...carried,
          shift: { x: point.x - carried.from.x, y: point.y - carried.from.y },
        }
        setHeld(live.current)
        onward?.(live.current)
      })()
    }
    const done = async (native: PointerEvent) => {
      forget()
      await pending
      const carried = live.current
      if (!carried) return
      const moved = dropped(carried)
      end?.(native.type === 'pointercancel' ? undefined : moved)
    }
    const forget = () => {
      window.removeEventListener('pointermove', follow)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
      letGo.current = null
      if (controls) controls.enabled = true
    }
    letGo.current = forget
    window.addEventListener('pointermove', follow)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)
  }

  const dropped = (carried: Held) => {
    live.current = null
    setHeld(null)
    if (controls) controls.enabled = true
    if (Math.hypot(carried.shift.x, carried.shift.y) < 30) return undefined
    return { from: carried.from, shift: carried.shift }
  }

  return { held, down }
}
