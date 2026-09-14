import type { HouseDocument } from '@houseit/core/document'
import { excavations } from '@houseit/geometry/excavation'
import { roomsOf } from '@houseit/geometry/rooms'
import { elementId } from '@houseit/geometry/wall-elements'
import { besideWall, paintFor } from '@houseit/scene/dressing'
import { pieceIdentity } from '@houseit/scene/piece-identity'
import type { Finish, Piece } from '@houseit/scene/pieces'
import { worldOf } from '@houseit/scene/world'
import { type BufferGeometry, Euler, type Material, Matrix4, MeshStandardMaterial } from 'three'
import { geometryBuffer } from './geometry-buffer'
import type { GeometryData, GeometryInput } from './geometry-protocol'
import { groundRepeat, paintGround } from './ground-appearance'
import { loadModel, modelGeometry } from './model-geometry'
import { pieceInput, piecePlacement } from './piece-geometry'
import { wallBody } from './wall-body'

export type GenerateGeometry = (input: GeometryInput) => Promise<GeometryData>
export type ArchivePaint = Finish & {
  doubleSided?: boolean
  symbol?: string
  nativeColour?: string
  vertexColors?: boolean
  imported?: {
    material: ReturnType<Material['toJSON']>
    textures: Record<string, unknown>
    images: Record<string, unknown>
  }
}
export type ArchivePart = {
  id: string
  entity: string
  geometry: BufferGeometry
  geometryKey: string
  transform: Matrix4
  paints: ArchivePaint[]
}

export async function* archiveScene(
  doc: HouseDocument,
  generate: GenerateGeometry,
): AsyncGenerator<ArchivePart> {
  const dressed = new Map(
    Object.keys(doc.levels).map((level) => [
      level,
      roomsOf(doc, level).map((room) => ({
        outline: room.nodes.map((id) => doc.nodes[id]!),
        worn: room.id ? doc.rooms[room.id] : undefined,
      })),
    ]),
  )
  for (const wall of Object.values(doc.walls)) {
    const input: GeometryInput = { kind: 'wall', body: wallBody(doc, wall) }
    const a = doc.nodes[wall.a]!,
      b = doc.nodes[wall.b]!
    const transform = new Matrix4().makeRotationY(Math.atan2(b.y - a.y, b.x - a.x))
    transform.setPosition(
      a.x / 1000,
      (doc.levels[wall.level]!.elevation + wall.baseOffset) / 1000,
      -a.y / 1000,
    )
    yield {
      id: `wall:${wall.id}`,
      entity: `elements:${elementId(wall)}`,
      geometry: geometryBuffer(await generate(input)),
      geometryKey: JSON.stringify(input),
      transform,
      paints: besideWall(dressed.get(wall.level)!, a, b, wall.thickness).map((side) =>
        paintFor(side?.walls, '#f1f0ed', { width: input.body.length, height: input.body.height }),
      ),
    }
  }
  const world = worldOf(doc)
  for (const storey of [...world.storeys, { level: undefined, elevation: 0, pieces: world.site }]) {
    for (const piece of storey.pieces) {
      if (piece.role === 'wall-solid' || piece.paint.opacity === 0) continue
      const { entity } = pieceIdentity(piece, doc, storey.level)
      if (piece.role === 'roof-solid' && !piece.entity)
        throw new Error('Roof geometry has no authoring identity')
      const placement = piecePlacement(piece)
      const transform = new Matrix4().makeRotationFromEuler(new Euler(...placement.rotation))
      transform.setPosition(
        placement.at[0],
        placement.at[1] + storey.elevation / 1000,
        placement.at[2],
      )
      const id = `${storey.level ?? 'site'}:${piece.name}`
      if (piece.body.kind === 'model') {
        const gltf = await loadModel(piece.body.file)
        const meshes = modelGeometry(gltf.scene, piece.body)
        try {
          for (const [index, mesh] of meshes.entries())
            yield {
              id: `${id}:${index}`,
              entity,
              transform,
              geometry: mesh.geometry.clone(),
              geometryKey: `${JSON.stringify(piece.body)}:${index}`,
              paints: [mesh.original].flat().map((material) => importedPaint(material, piece)),
            }
        } finally {
          for (const mesh of meshes) mesh.geometry.dispose()
        }
      } else {
        const input = pieceInput(piece.body)
        yield {
          id,
          entity,
          transform,
          geometry: geometryBuffer(await generate(input)),
          geometryKey: JSON.stringify(input),
          paints:
            piece.body.kind === 'symbol'
              ? [{ ...piece.paint, symbol: piece.body.file, doubleSided: false }]
              : [
                  {
                    ...piece.paint,
                    doubleSided: piece.body.kind === 'sheet' && piece.body.doubleSided !== false,
                  },
                  ...(piece.body.kind === 'prism' && piece.sidePaint ? [piece.sidePaint] : []),
                ],
        }
      }
    }
  }
  const input: GeometryInput = {
    kind: 'ground',
    holes: excavations(doc).map((ring) => ring.map((p) => ({ x: p.x, z: -p.y }))),
  }
  yield {
    id: 'terrain:ground',
    entity: 'terrain',
    geometry: paintGround(geometryBuffer(await generate(input))),
    geometryKey: JSON.stringify(input),
    transform: new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, -0.01, 0),
    paints: [
      {
        colour: '#ffffff',
        nativeColour: '#668c38',
        texture: 'houseit:ground',
        repeat: groundRepeat,
        vertexColors: true,
        roughness: 1,
      },
    ],
  }
}

function importedPaint(material: Material, piece: Piece): ArchivePaint {
  if (!(material instanceof MeshStandardMaterial))
    throw new Error(`Unsupported imported material ${material.type}`)
  const recolour = /^(body)?$/.test(material.name)
  const meta = {
    geometries: {},
    materials: {},
    textures: {},
    images: {},
    shapes: {},
    skeletons: {},
    animations: {},
    nodes: {},
  }
  const definition = material.toJSON(meta)
  return {
    ...(recolour ? piece.paint : { colour: `#${material.color.getHexString()}` }),
    opacity: material.opacity,
    roughness: material.roughness,
    doubleSided: material.side === 2,
    imported: { material: definition, ...meta },
  }
}
