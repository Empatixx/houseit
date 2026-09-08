import type { Body, Corner, Finish, Piece } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { type BufferGeometry, ExtrudeGeometry, Path, Shape, ShapeGeometry } from 'three'
import { MM } from '../plan-coordinates'
import { Brought } from './brought'
import { materialOf } from './materials'
import { SymbolPlate } from './symbol-plate'

const QUARTER = Math.PI / 2

const sided = (body: Body) => body.kind === 'sheet'

type PieceProps = {
  piece: Piece
  tint?: string
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

export function StandingPiece({ piece, tint, onPick }: PieceProps) {
  const { body, at } = piece
  const paint: Finish = tint
    ? { ...piece.paint, colour: tint, ...(piece.paint.opacity === 0 ? { opacity: 0.35 } : {}) }
    : piece.paint
  const turn = piece.turn ?? 0
  const tilt = piece.tilt ?? 0
  const roll = piece.roll ?? 0
  const place: [number, number, number] = [at.x * MM, at.y * MM, at.z * MM]

  if (body.kind === 'model') {
    return (
      <group position={place} rotation={[tilt, turn, roll, 'YXZ']} onClick={onPick}>
        <Brought file={body.file} size={body} paint={paint} />
      </group>
    )
  }

  if (body.kind === 'symbol') {
    return (
      <SymbolPlate
        body={body}
        paint={piece.paint}
        tint={tint}
        at={place}
        rotation={[tilt - QUARTER, turn, roll + Math.PI]}
        onPick={onPick}
      />
    )
  }

  if (body.kind === 'prism' || body.kind === 'sheet') {
    const drop = body.kind === 'prism' ? (body.thickness / 2) * MM : 0
    return (
      <Flat
        body={body}
        at={[place[0], place[1] - drop, place[2]]}
        rotation={[tilt - QUARTER, turn, roll, 'YXZ']}
        material={materialOf(paint, sided(body))}
        onPick={onPick}
      />
    )
  }

  return (
    <mesh
      position={place}
      rotation={[tilt, turn, roll, 'YXZ']}
      scale={body.kind === 'drum' ? [1, 1, body.stretch] : undefined}
      material={materialOf(paint, sided(body))}
      onClick={onPick}
    >
      {body.kind === 'box' ? (
        <boxGeometry args={[body.width * MM, body.height * MM, body.depth * MM]} />
      ) : body.kind === 'drum' ? (
        <cylinderGeometry
          args={[body.top * MM, body.radius * MM, body.height * MM, 28, 1, body.open]}
        />
      ) : (
        <sphereGeometry args={[body.radius * MM, 18, 14]} />
      )}
    </mesh>
  )
}

type FlatProps = {
  body: Extract<Body, { kind: 'prism' | 'sheet' }>
  at: [number, number, number]
  rotation: [number, number, number, 'YXZ']
  material: ReturnType<typeof materialOf>
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

function Flat({ body, at, rotation, material, onPick }: FlatProps) {
  const geometry = useMemo(() => flatGeometry(body), [body])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={at}
      rotation={rotation}
      onClick={onPick}
    />
  )
}

function flatGeometry(body: Extract<Body, { kind: 'prism' | 'sheet' }>): BufferGeometry {
  const shape = shapeOf(body.outline, body.holes)
  return body.kind === 'prism'
    ? new ExtrudeGeometry(shape, { depth: body.thickness * MM, bevelEnabled: false })
    : new ShapeGeometry(shape)
}

function shapeOf(outline: Corner[], holes: Corner[][]): Shape {
  const shape = new Shape()
  outline.forEach((corner, index) => {
    if (index === 0) shape.moveTo(corner.x * MM, -corner.z * MM)
    else shape.lineTo(corner.x * MM, -corner.z * MM)
  })
  shape.closePath()
  for (const ring of holes) {
    const hole = new Path()
    ring.forEach((corner, index) => {
      if (index === 0) hole.moveTo(corner.x * MM, -corner.z * MM)
      else hole.lineTo(corner.x * MM, -corner.z * MM)
    })
    hole.closePath()
    shape.holes.push(hole)
  }
  return shape
}
