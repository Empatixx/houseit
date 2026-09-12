import type { Body, Corner, Finish, Piece } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ShapeGeometry,
} from 'three'
import { MM } from '../plan-coordinates'
import { Brought } from './brought'
import { materialOf, seeThrough } from './materials'
import { SymbolPlate } from './symbol-plate'

const QUARTER = Math.PI / 2

const sided = (body: Body) => body.kind === 'sheet' && body.doubleSided !== false

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

  if (body.kind === 'box' && body.faces) {
    return <BoxSkin piece={piece} faces={body.faces} paint={paint} onPick={onPick} />
  }

  if (body.kind === 'prism' || body.kind === 'sheet') {
    const drop = body.kind === 'prism' ? (body.thickness / 2) * MM : 0
    return (
      <Flat
        body={body}
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
    <mesh
      castShadow={piece.casts !== false && !seeThrough(paint)}
      receiveShadow
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
  material: ReturnType<typeof materialOf> | ReturnType<typeof materialOf>[]
  shadows: boolean
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

function Flat({ body, at, rotation, material, shadows, onPick }: FlatProps) {
  const geometry = useMemo(() => flatGeometry(body), [body])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh
      castShadow={shadows}
      receiveShadow
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

function BoxSkin({ piece, faces, paint, onPick }: PieceProps & { faces: number[]; paint: Finish }) {
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
    // Preserve BoxGeometry's normalized texture coordinates after clipping.
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
    <mesh
      geometry={geometry}
      material={materialOf(paint, false)}
      position={[piece.at.x * MM, piece.at.y * MM, piece.at.z * MM]}
      rotation={[0, piece.turn ?? 0, 0]}
      castShadow={piece.casts !== false}
      receiveShadow
      onClick={onPick}
    />
  )
}

// Replace only the upward cap; the soffit and slab edges keep their geometry.
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
