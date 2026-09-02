import type { HouseObject } from '@houseit/core/document'
import { type Layer, layerOf, symbolOf } from '@houseit/core/object-types'
import { type Surface, surfaceOf } from '@houseit/core/surfaces'
import { roomsOf } from '@houseit/geometry/rooms'
import { type Spot, standingAt } from '@houseit/geometry/standing'
import { useEffect, useMemo, useState } from 'react'
import type { Texture } from 'three'
import { selectionStore } from '../../store/selection'
import { useDocument } from '../../store/store'
import { MM, toWorld } from '../plan-coordinates'
import { symbolHeight } from './stacking'
import { symbolTexture } from './symbol-texture'

/**
 * The furniture, drawn from the plan symbols in the catalogue.
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
        const symbol = symbolOf(object.type)
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
  symbol: string
  stack: { layer: Layer; index: number }
}

/**
 * A thing drawn from its plan symbol: one flat picture the size of the thing,
 * laid where it stands and turned the way it faces.
 *
 * The symbol's top edge is the thing's back, so the picture is laid with its top
 * towards the wall the thing backs onto — which is `-y` in the thing's own frame.
 * Nothing casts a shadow: the drawing carries its own weight, the way it did
 * where it came from.
 */
function Glyph({ object, spot, surface, symbol, stack }: GlyphProps) {
  const texture = useSymbol(symbol, surface, object)
  if (!texture) return null

  return (
    <mesh
      position={toWorld(spot.at.x, spot.at.y, symbolHeight(stack))}
      // Laid flat, then turned the way the thing faces. The plane's own +y ends
      // up as plan +y once it lies down, which is the thing's front — so it is
      // turned half round to put the symbol's top at the back.
      rotation={[-Math.PI / 2, 0, spot.turn + Math.PI]}
      onClick={(event) => {
        if (event.delta > 4) return
        event.stopPropagation()
        selectionStore.getState().select({ kind: 'object', id: object.id })
      }}
    >
      <planeGeometry args={[object.width * MM, object.depth * MM]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} />
    </mesh>
  )
}

/** The rasterised symbol, once it has loaded; nothing until then. */
function useSymbol(symbol: string, surface: Surface, size: { width: number; depth: number }) {
  const [texture, setTexture] = useState<Texture | undefined>(undefined)
  const fill = surface.fill

  useEffect(() => {
    let live = true
    symbolTexture(symbol, fill, size)
      .then((loaded) => {
        if (live) setTexture(loaded)
      })
      .catch(() => {
        if (live) setTexture(undefined)
      })
    return () => {
      live = false
    }
  }, [symbol, fill, size.width, size.depth])

  return texture
}
