import type { HouseObject } from '@houseit/core/document'
import { importedType, outlineSymbol } from '@houseit/core/imported'
import { type Layer, layerOf, symbolOf } from '@houseit/core/object-types'
import { stairKind, stairShape, stairSymbol } from '@houseit/core/stairs'
import { type Surface, surfaceOf } from '@houseit/core/surfaces'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, type Spot, standingAt, turnOf } from '@houseit/geometry/standing'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { aimAt, putDown } from '../../edit/draw-commands'
import { moveTo, turnTo } from '../../edit/object-commands'
import { pick } from '../../edit/pick'
import { placeArmedIn } from '../../edit/place-commands'
import { EMPHASIS, hoverStore, useHover } from '../../store/hover'
import { useSelection } from '../../store/selection'
import { useDocument, usePlanDoc } from '../../store/store'
import { toolStore } from '../../store/tool'
import { dragged, pointOnPlan } from '../drag'
import { MM, toWorld } from '../plan-coordinates'
import { symbolHeight } from './stacking'
import { useSymbol } from './use-symbol'

function drawingOf(
  doc: Parameters<typeof standingAt>[0],
  level: string,
  object: { type: string; width: number },
): { key: string; svg: string } | undefined {
  const brought = importedType(object.type)
  if (brought) return { key: `imported:${brought.id}`, svg: outlineSymbol(brought) }

  const kind = stairKind(object.type)
  if (!kind) return undefined
  const height = doc.levels[level]?.height ?? 2800
  const shape = stairShape(kind, height, object.width)
  return { key: `stairs:${kind}:${height}:${object.width}`, svg: stairSymbol(shape) }
}

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
      .flatMap((object, order) => {
        const room = rooms.get(object.room)
        const spot = room ? standingAt(doc, level, room, object) : undefined
        const surface = surfaceOf(object.surface)
        const symbol = drawingOf(doc, level, object) ?? symbolOf(object.type)
        if (!spot || !surface || !symbol) return []
        return [
          { object, spot, surface, symbol, stack: { layer: layerOf(object.type), index: order } },
        ]
      })
  }, [doc, level])

  return (
    <>
      {drawn.map((entry) => (
        <Glyph key={entry.object.id} {...entry} />
      ))}
    </>
  )
}

type GlyphProps = {
  object: HouseObject
  spot: Spot
  surface: Surface
  symbol: string | { key: string; svg: string }
  stack: { layer: Layer; index: number }
}

function Glyph({ object, spot, surface, symbol, stack }: GlyphProps) {
  const texture = useSymbol(symbol, surface, object)
  const drag = useDrag(object, spot)
  const spin = useSpin(object, spot)
  const picked = useSelection(
    (state) => state.selected?.kind === 'object' && state.selected.id === object.id,
  )
  const hovered = useHover(
    (state) => state.hovered?.kind === 'object' && state.hovered.id === object.id,
  )
  if (!texture) return null

  const at = { x: spot.at.x + drag.shift.x, y: spot.at.y + drag.shift.y }
  const turn = spin.preview ?? spot.turn
  const tint = picked ? EMPHASIS.picked.tint : hovered ? EMPHASIS.hovered.tint : '#ffffff'

  const reach = object.depth / 2 + 350
  const handle = { x: at.x - Math.sin(turn) * reach, y: at.y + Math.cos(turn) * reach }

  const on = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    const where = { x: event.point.x / MM, y: -event.point.z / MM }
    return piecesOf({ at, turn }, object).some((piece) => containsPoint(piece, where.x, where.y))
  }

  return (
    <>
      <mesh
        position={toWorld(at.x, at.y, symbolHeight(stack))}
        rotation={[-Math.PI / 2, 0, turn + Math.PI]}
        onPointerOver={(event) => {
          if (!on(event)) return
          event.stopPropagation()
          hoverStore.getState().hover({ kind: 'object', id: object.id })
        }}
        onPointerOut={() => hoverStore.getState().hover(null)}
        onClick={(event) => {
          if (dragged(event) || !on(event)) return
          event.stopPropagation()
          const armed = toolStore.getState().armed
          if (armed) {
            const point = { x: event.point.x / MM, y: -event.point.z / MM }
            if (armed.kind === 'wall') {
              putDown(point)
              return
            }
            if (placeArmedIn(armed, object.room, point) && !event.shiftKey) {
              toolStore.getState().arm(null)
            }
            return
          }
          pick({ kind: 'object', id: object.id })
        }}
        onPointerDown={(event) => {
          if (toolStore.getState().armed?.kind === 'wall' || !on(event)) return
          drag.down(event)
        }}
        onPointerMove={(event) => {
          if (toolStore.getState().armed?.kind === 'wall') {
            aimAt({ x: event.point.x / MM, y: -event.point.z / MM })
            return
          }
          drag.move(event)
        }}
        onPointerUp={drag.up}
      >
        <planeGeometry args={[object.width * MM, object.depth * MM]} />
        <meshBasicMaterial
          map={texture}
          color={tint}
          transparent
          alphaTest={0.02}
          opacity={drag.live ? 0.7 : 1}
        />
      </mesh>
      {picked ? (
        <mesh
          position={toWorld(handle.x, handle.y, symbolHeight(stack) + 400)}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={spin.down}
          onPointerMove={spin.move}
          onPointerUp={spin.up}
        >
          <circleGeometry args={[0.13, 24]} />
          <meshBasicMaterial color={EMPHASIS.picked.line} />
        </mesh>
      ) : null}
    </>
  )
}

function useSpin(object: HouseObject, spot: Spot) {
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const holding = useRef(false)
  const [preview, setPreview] = useState<number | null>(null)
  const base = spot.turn - turnOf(object)

  const angleTo = (point: Point) => {
    const total = Math.atan2(point.y - spot.at.y, point.x - spot.at.x) - Math.PI / 2
    const degrees = Math.round(((total - base) * 180) / Math.PI / 15) * 15
    return ((degrees % 360) + 360) % 360
  }

  const down = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    holding.current = true
    if (controls) controls.enabled = false
  }
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!holding.current) return
    const now = pointOnPlan(event.ray)
    if (!now) return
    setPreview(base + (angleTo(now) * Math.PI) / 180)
  }
  const up = (event: ThreeEvent<PointerEvent>) => {
    if (!holding.current) return
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    holding.current = false
    if (controls) controls.enabled = true
    const now = pointOnPlan(event.ray)
    setPreview(null)
    if (!now) return
    const degrees = angleTo(now)
    const normalised = degrees > 180 ? degrees - 360 : degrees
    if (normalised !== (object.rotation ?? 0)) turnTo(object, normalised)
  }

  return { preview, down, move, up }
}

type Carried = { from: Point; shift: Point }

function useDrag(object: HouseObject, spot: Spot) {
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const held = useRef<Carried | null>(null)
  const [shift, setShift] = useState<Point>({ x: 0, y: 0 })

  const down = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    const from = pointOnPlan(event.ray)
    if (!from) return
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    held.current = { from, shift: { x: 0, y: 0 } }
    if (controls) controls.enabled = false
  }

  const move = (event: ThreeEvent<PointerEvent>) => {
    const carried = held.current
    if (!carried) return
    const now = pointOnPlan(event.ray)
    if (!now) return
    carried.shift = { x: now.x - carried.from.x, y: now.y - carried.from.y }
    setShift(carried.shift)
  }

  const up = (event: ThreeEvent<PointerEvent>) => {
    const carried = held.current
    if (!carried) return
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    held.current = null
    setShift({ x: 0, y: 0 })
    if (controls) controls.enabled = true
    if (Math.hypot(carried.shift.x, carried.shift.y) < 30) return
    moveTo(object, { x: spot.at.x + carried.shift.x, y: spot.at.y + carried.shift.y })
  }

  return { shift, live: held.current !== null, down, move, up }
}
