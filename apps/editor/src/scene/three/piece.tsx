import type { Body, Finish, Piece } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import type { ComponentProps } from 'react'
import { useNativeGeometry } from '../../engine/use-wall-geometry'
import { MM } from '../plan-coordinates'
import { Brought } from './brought'
import { materialOf, seeThrough } from './materials'
import { PieceMesh } from './piece-mesh'
import { SymbolPlate } from './symbol-plate'

const QUARTER = Math.PI / 2

const sided = (body: Body) => body.kind === 'sheet' && body.doubleSided !== false

type PieceProps = {
  piece: Piece
  native: { id: string; elevation: number; category?: string }
  tint?: string
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

export function StandingPiece({ piece, tint, onPick, native: display }: PieceProps) {
  const native = { ...display, owner: piece.of }
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
      <Brought
        file={body.file}
        size={body}
        paint={paint}
        native={native}
        at={place}
        rotation={[tilt, turn, roll, 'YXZ']}
        onPick={onPick}
      />
    )
  }

  if (body.kind === 'symbol') {
    return (
      <SymbolPlate
        native={native}
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
        native={{
          ...native,
          category:
            native.category ??
            (piece.of?.kind === 'object'
              ? 'IFCFURNISHINGELEMENT'
              : piece.role === 'floor-surface'
                ? 'IFCCOVERING'
                : 'IFCSLAB'),
        }}
        shadows={piece.casts !== false && !seeThrough(paint)}
        at={[place[0], place[1] - drop, place[2]]}
        rotation={[tilt - QUARTER, turn, roll, 'YXZ']}
        material={
          piece.sidePaint && body.kind === 'prism'
            ? [
                materialOf(paint, false),
                materialOf(tint ? { ...piece.sidePaint, colour: tint } : piece.sidePaint, false),
              ]
            : materialOf(paint, sided(body))
        }
        onPick={onPick}
      />
    )
  }

  return (
    <Solid
      body={body}
      native={native}
      at={place}
      rotation={[tilt, turn, roll, 'YXZ']}
      material={materialOf(paint, sided(body))}
      shadows={piece.casts !== false && !seeThrough(paint)}
      onPick={onPick}
    />
  )
}

function Solid({
  body,
  ...props
}: Omit<ComponentProps<typeof PieceMesh>, 'geometry'> & {
  body: Extract<Body, { kind: 'box' | 'drum' | 'ball' }>
}) {
  const { geometry, key } = useNativeGeometry({ kind: 'primitive', body })
  if (!geometry) return null
  return <PieceMesh {...props} geometry={geometry} geometryKey={key} />
}

type FlatProps = {
  native: { id: string; elevation: number; owner?: Piece['of']; category: string }
  body: Extract<Body, { kind: 'prism' | 'sheet' }>
  at: [number, number, number]
  rotation: [number, number, number, 'YXZ']
  material: ReturnType<typeof materialOf> | ReturnType<typeof materialOf>[]
  shadows: boolean
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

function Flat({ body, at, rotation, material, shadows, onPick, native }: FlatProps) {
  const { geometry, key } = useNativeGeometry({ kind: 'profile', body })
  if (!geometry) return null
  return (
    <PieceMesh
      native={native}
      geometry={geometry}
      geometryKey={
        native.owner?.kind === 'object' ||
        native.category === 'IFCSTAIR' ||
        native.category === 'IFCRAMP' ||
        native.category === 'IFCROOF' ||
        native.category === 'IFCGEOGRAPHICELEMENT'
          ? key
          : undefined
      }
      material={material}
      at={at}
      rotation={rotation}
      shadows={shadows}
      onPick={onPick}
    />
  )
}
