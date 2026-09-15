import type { HouseObject } from '@houseit/core/document'
import type { Layer } from '@houseit/core/object-types'
import type { Dimension } from '@houseit/geometry/dimensions'
import type { Point } from '@houseit/geometry/outlines'
import { piecesOf, type Spot } from '@houseit/geometry/standing'
import { Line } from '@react-three/drei'
import type { Texture } from 'three'
import { ABOVE, DimensionLine } from '../dimensions'
import { MM, toWorld } from '../plan-coordinates'
import { symbolHeight } from './stacking'

const GHOST = '#a1a1aa'

type GhostProps = {
  object: HouseObject
  spot: Spot
  at: Point
  texture: Texture
  stack: { layer: Layer; index: number }
}

export function FurnitureGhost({ object, spot, at, texture, stack }: GhostProps) {
  const across = Math.round(at.x - spot.at.x)
  const down = Math.round(at.y - spot.at.y)
  const corner = { x: at.x, y: spot.at.y }

  const legs: Dimension[] = []
  if (across !== 0) {
    legs.push({ from: spot.at, to: corner, length: Math.abs(across), offset: { x: 0, y: 1 } })
  }
  if (down !== 0) {
    legs.push({ from: corner, to: at, length: Math.abs(down), offset: { x: 1, y: 0 } })
  }

  return (
    <>
      <mesh
        position={toWorld(spot.at.x, spot.at.y, symbolHeight(stack) - 5)}
        rotation={[-Math.PI / 2, 0, spot.turn + Math.PI]}
      >
        <planeGeometry args={[object.width * MM, object.depth * MM]} />
        <meshBasicMaterial
          map={texture}
          color={GHOST}
          transparent
          alphaTest={0.02}
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
      {piecesOf(spot, object).map((piece) => (
        <Line
          key={`${piece[0]?.x},${piece[0]?.y}`}
          points={[...piece, piece[0]!].map((point) => toWorld(point.x, point.y, ABOVE))}
          color={GHOST}
          lineWidth={1}
        />
      ))}
      {legs.map((leg) => (
        <DimensionLine
          key={`${leg.from.x},${leg.from.y}-${leg.to.x},${leg.to.y}`}
          dimension={leg}
        />
      ))}
    </>
  )
}
