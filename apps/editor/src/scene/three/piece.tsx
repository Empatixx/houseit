import type { Body, Corner, Finish, Piece } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import { type ComponentProps, useEffect, useMemo } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from 'three'
import { MM } from '../plan-coordinates'
import { Brought } from './brought'
import { materialOf, seeThrough } from './materials'
import { PieceMesh } from './piece-mesh'
import { SymbolPlate } from './symbol-plate'

const QUARTER = Math.PI / 2

const sided = (body: Body) => body.kind === 'sheet' && body.doubleSided !== false

type PieceProps = {
  piece: Piece
  native?: { id: string; elevation: number; category?: string }
  tint?: string
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

export function StandingPiece({ piece, tint, onPick, native: display }: PieceProps) {
  const native = display ? { ...display, owner: piece.of } : undefined
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

  if (body.kind === 'box' && body.faces) {
    return (
      <BoxSkin native={native} piece={piece} faces={body.faces} paint={paint} onPick={onPick} />
    )
  }

  if (body.kind === 'prism' || body.kind === 'sheet') {
    const drop = body.kind === 'prism' ? (body.thickness / 2) * MM : 0
    return (
      <Flat
        body={body}
        native={
          native
            ? {
                ...native,
                owner: piece.of,
                category:
                  native.category ??
                  (piece.of?.kind === 'object'
                    ? 'IFCFURNISHINGELEMENT'
                    : piece.role === 'floor-surface'
                      ? 'IFCCOVERING'
                      : 'IFCSLAB'),
              }
            : undefined
        }
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
  const key = JSON.stringify(body)
  const geometry = useMemo(() => {
    const shape = JSON.parse(key) as typeof body
    if (shape.kind === 'box')
      return new BoxGeometry(shape.width * MM, shape.height * MM, shape.depth * MM)
    if (shape.kind === 'drum')
      return new CylinderGeometry(
        shape.top * MM,
        shape.radius * MM,
        shape.height * MM,
        28,
        1,
        shape.open,
      ).scale(1, 1, shape.stretch)
    return new SphereGeometry(shape.radius * MM, 18, 14)
  }, [key])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <PieceMesh {...props} geometry={geometry} geometryKey={key} />
}

type FlatProps = {
  native?: { id: string; elevation: number; owner?: Piece['of']; category: string }
  body: Extract<Body, { kind: 'prism' | 'sheet' }>
  at: [number, number, number]
  rotation: [number, number, number, 'YXZ']
  material: ReturnType<typeof materialOf> | ReturnType<typeof materialOf>[]
  shadows: boolean
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

function Flat({ body, at, rotation, material, shadows, onPick, native }: FlatProps) {
  const geometry = useMemo(() => flatGeometry(body), [body])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <PieceMesh
      native={native}
      geometry={geometry}
      geometryKey={
        native?.owner?.kind === 'object' ||
        native?.category === 'IFCSTAIR' ||
        native?.category === 'IFCRAMP' ||
        native?.category === 'IFCROOF'
          ? JSON.stringify(body)
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

function flatGeometry(body: Extract<Body, { kind: 'prism' | 'sheet' }>): BufferGeometry {
  const shape = shapeOf(body.outline, body.holes)
  let geometry: BufferGeometry =
    body.kind === 'prism'
      ? new ExtrudeGeometry(shape, { depth: body.thickness * MM, bevelEnabled: false })
      : new ShapeGeometry(shape)
  if (body.kind === 'prism' && body.top !== undefined)
    geometry = replaceTop(geometry, body.top, body.thickness * MM)
  if (body.kind === 'prism' && body.slope) {
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i += 1) {
      positions.setZ(
        i,
        positions.getZ(i) +
          (body.slope.both ? 1 : positions.getZ(i) / (body.thickness * MM)) *
            (positions.getX(i) * body.slope.x -
              positions.getY(i) * body.slope.z +
              body.slope.offset * MM),
      )
    }
    geometry.computeVertexNormals()
  }
  return geometry
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

function BoxSkin({
  piece,
  faces,
  paint,
  onPick,
  native,
}: PieceProps & { faces: number[]; paint: Finish }) {
  const geometry = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        faces.map((n) => n * MM),
        3,
      ),
    )
    geometry.computeVertexNormals()
    const normals = geometry.getAttribute('normal')
    const body = piece.body
    if (body.kind !== 'box') return geometry
    const uv = []
    for (let i = 0; i < faces.length / 3; i++) {
      const x = faces[i * 3]! / body.width,
        y = faces[i * 3 + 1]! / body.height,
        z = faces[i * 3 + 2]! / body.depth
      const nx = normals.getX(i),
        ny = normals.getY(i),
        nz = normals.getZ(i)
      uv.push(
        (Math.abs(nx) > 0.5 ? -nx * z : Math.abs(nz) > 0.5 ? nz * x : x) + 0.5,
        (Math.abs(ny) > 0.5 ? -ny * z : y) + 0.5,
      )
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    return geometry
  }, [faces, piece.body])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <PieceMesh
      native={native ? { ...native, owner: piece.of } : undefined}
      geometry={geometry}
      geometryKey={JSON.stringify(piece.body)}
      material={materialOf(paint, false)}
      at={[piece.at.x * MM, piece.at.y * MM, piece.at.z * MM]}
      rotation={[0, piece.turn ?? 0, 0, 'YXZ']}
      shadows={piece.casts !== false}
      onPick={onPick}
    />
  )
}

function replaceTop(original: BufferGeometry, top: Corner[][], depth: number): BufferGeometry {
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = []
  const groups: { start: number; count: number; materialIndex: number }[] = []
  const append = (geometry: BufferGeometry, cap: boolean) => {
    const p = geometry.getAttribute('position'),
      n = geometry.getAttribute('normal'),
      uv = geometry.getAttribute('uv')
    const index = geometry.getIndex()
    const count = index?.count ?? p.count
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j))
      if (!cap && ids.every((j) => n.getZ(j) > 0.99 && Math.abs(p.getZ(j) - depth) < 1e-5)) continue
      const materialIndex = cap || Math.abs(n.getZ(ids[0]!)) > 0.99 ? 0 : 1
      const last = groups.at(-1)
      if (last?.materialIndex === materialIndex) last.count += 3
      else groups.push({ start: positions.length / 3, count: 3, materialIndex })
      for (const j of ids) {
        positions.push(p.getX(j), p.getY(j), cap ? depth : p.getZ(j))
        normals.push(n.getX(j), n.getY(j), n.getZ(j))
        uvs.push(uv.getX(j), uv.getY(j))
      }
    }
  }
  append(original, false)
  const cap = new ShapeGeometry(top.map((ring) => shapeOf(ring, [])))
  append(cap, true)
  original.dispose()
  cap.dispose()
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  for (const g of groups) geometry.addGroup(g.start, g.count, g.materialIndex)
  return geometry
}
