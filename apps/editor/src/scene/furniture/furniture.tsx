import type { HouseObject } from '@houseit/core/document'
import { geometryEntityKey } from '@houseit/core/entity-key'
import { partsOf } from '@houseit/core/footprint'
import { importedType, outlineSymbol } from '@houseit/core/imported'
import { type Layer, layerOf, symbolOf } from '@houseit/core/object-types'
import { isStaircase, stairKind, stairShape, stairSymbol } from '@houseit/core/stairs'
import { type Surface, surfaceOf } from '@houseit/core/surfaces'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, type Spot, standingAt } from '@houseit/geometry/standing'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Euler, Matrix4, MeshBasicMaterial } from 'three'
import { aimAt, putDown } from '../../edit/draw-commands'
import { pick } from '../../edit/pick'
import { placeArmedIn } from '../../edit/place-commands'
import { NativeSurface } from '../../engine/fragment-display-layer'
import { useNativeGeometry } from '../../engine/use-wall-geometry'
import { engineViewStore } from '../../store/engine-view'
import { EMPHASIS, hoverStore, useHover } from '../../store/hover'
import { useSelection } from '../../store/selection'
import { useDocument, usePlanDoc } from '../../store/store'
import { toolStore } from '../../store/tool'
import { ABOVE } from '../dimensions'
import { dragged } from '../drag'
import { usePlain } from '../plain'
import { MM, toWorld } from '../plan-coordinates'
import { FurnitureGhost } from './furniture-ghost'
import { symbolHeight } from './stacking'
import { Dial, Turner } from './turning'
import { useFurnitureDrag } from './use-furniture-drag'
import { useFurnitureSpin } from './use-furniture-spin'
import { PICKED_HATCH, pickedSurface, useSymbol } from './use-symbol'

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
  const plainly = usePlain()
  const chosen = useSelection(
    (state) => state.selected?.kind === 'object' && state.selected.id === object.id,
  )
  const picked = chosen && !plainly
  const noticed = useHover(
    (state) => state.hovered?.kind === 'object' && state.hovered.id === object.id,
  )
  const hovered = noticed && !plainly
  const plain = useSymbol(symbol, surface, object)
  const marked = useSymbol(picked ? symbol : '', pickedSurface(surface), object, PICKED_HATCH)
  const drag = useFurnitureDrag(object, spot)
  const spin = useFurnitureSpin(object, spot, picked)
  const profiles = useMemo(
    () =>
      partsOf(object.type).map((part) => {
        const x0 = (part.x0 - 0.5) * object.width,
          x1 = (part.x1 - 0.5) * object.width
        const z0 = (part.y0 - 0.5) * object.depth,
          z1 = (part.y1 - 0.5) * object.depth
        return {
          outline: [
            { x: x0, z: z0 },
            { x: x1, z: z0 },
            { x: x1, z: z1 },
            { x: x0, z: z1 },
          ],
          holes: [],
        }
      }),
    [object.type, object.width, object.depth],
  )
  const { geometry: nativeFootprint, key: geometryKey } = useNativeGeometry({
    kind: 'sheets',
    profiles,
    textureSize: { width: object.width, depth: object.depth },
  })

  const texture = (picked ? marked : undefined) ?? plain
  const at = { x: spot.at.x + drag.shift.x, y: spot.at.y + drag.shift.y }
  const turn = spin.preview ?? spot.turn
  const tint = picked
    ? marked
      ? '#ffffff'
      : EMPHASIS.picked.tint
    : hovered
      ? EMPHASIS.hovered.tint
      : '#ffffff'

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: texture,
        color: tint,
        transparent: true,
        alphaTest: 0.02,
        opacity: drag.live ? 0.7 : 1,
      }),
    [texture, tint, drag.live],
  )
  useEffect(() => () => material.dispose(), [material])
  if (!plain || !nativeFootprint) return null
  const transform = new Matrix4()
    .makeRotationFromEuler(new Euler(-Math.PI / 2, 0, turn + Math.PI))
    .setPosition(...toWorld(at.x, at.y, symbolHeight(stack)))
  const reach = (Math.hypot(object.width, object.depth) / 2 + 280) * Math.SQRT1_2
  const grip = { x: at.x + reach, y: at.y + reach }

  const on = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    const where = { x: event.point.x / MM, y: -event.point.z / MM }
    return piecesOf({ at, turn }, object).some((piece) => containsPoint(piece, where.x, where.y))
  }

  return (
    <>
      {drag.live ? (
        <FurnitureGhost object={object} spot={spot} at={at} texture={plain} stack={stack} />
      ) : null}
      <NativeSurface
        surface={{
          id: `object:${object.id}`,
          entity: isStaircase(object.type)
            ? geometryEntityKey('IFCSTAIR', `objects:${object.id}`)
            : `objects:${object.id}`,
          owner: { kind: 'object', id: object.id },
          category: 'IFCFURNISHINGELEMENT',
          geometry: nativeFootprint,
          geometryKey,
          materials: [material],
          transform,
          mapping: { kind: 'source', geometry: nativeFootprint },
          casts: false,
        }}
        gesture={drag.live || spin.preview !== null}
        onPointerOver={(event) => {
          if (!on(event)) return
          event.stopPropagation()
          hoverStore.getState().hover({ kind: 'object', id: object.id })
        }}
        onPointerOut={() => hoverStore.getState().hover(null)}
        onClick={(event) => {
          if (engineViewStore.getState().measure !== 'none' || dragged(event) || !on(event)) return
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
          if (
            engineViewStore.getState().measure !== 'none' ||
            toolStore.getState().armed ||
            event.button !== 0 ||
            !on(event)
          )
            return
          pick({ kind: 'object', id: object.id })
          drag.down(event)
        }}
        onPointerMove={(event) => {
          if (toolStore.getState().armed?.kind === 'wall') {
            aimAt({ x: event.point.x / MM, y: -event.point.z / MM })
          }
        }}
      />
      {picked ? (
        <>
          {spin.open ? (
            <Dial
              centre={at}
              height={ABOVE}
              base={spin.base}
              turn={turn}
              radius={Math.hypot(object.width, object.depth) / 2 + 520}
            />
          ) : null}
          {spin.open ? (
            <mesh
              position={toWorld(at.x, at.y, ABOVE)}
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerDown={(event) => {
                if (engineViewStore.getState().measure === 'none') spin.down(event)
              }}
              onPointerMove={spin.move}
              onPointerUp={spin.up}
              onClick={spin.click}
            >
              <circleGeometry args={[REACH, 40]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ) : null}
          {spin.open ? null : <Turner at={grip} height={ABOVE} />}
          <mesh
            position={toWorld(grip.x, grip.y, ABOVE)}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={(event) => {
              if (engineViewStore.getState().measure === 'none') spin.down(event)
            }}
            onPointerMove={spin.move}
            onPointerUp={spin.up}
            onClick={spin.click}
          >
            <circleGeometry args={[0.3, 20]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      ) : null}
    </>
  )
}

const REACH = 60
