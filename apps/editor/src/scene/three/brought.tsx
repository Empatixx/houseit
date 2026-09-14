import type { Finish } from '@houseit/scene/pieces'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Box3, Group, type Material, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { MM } from '../plan-coordinates'
import { textureOf } from './materials'
import { type NativePiece, PieceMesh } from './piece-mesh'

const TAKES_THE_SURFACE = /^(body)?$/

type BroughtProps = {
  file: string
  size: { width: number; height: number; depth: number }
  paint: Finish
  native: NativePiece
  at: [number, number, number]
  rotation: [number, number, number, 'YXZ']
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

export function Brought({ file, size, paint, native, at, rotation, onPick }: BroughtProps) {
  const { scene } = useGLTF(`/models/${file}`)
  const { width, height, depth } = size
  const built = useMemo(() => {
    const model = scene.clone(true)
    const box = new Box3().setFromObject(model)
    const measured = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    model.position.set(-centre.x, -box.min.y, -centre.z)
    const stood = new Group()
    stood.add(model)
    stood.scale.set(
      measured.x === 0 ? 1 : (width * MM) / measured.x,
      measured.y === 0 ? 1 : (height * MM) / measured.y,
      measured.z === 0 ? 1 : (depth * MM) / measured.z,
    )
    stood.position.y = -(height * MM) / 2
    stood.updateMatrixWorld(true)
    const meshes: {
      id: string
      geometry: Mesh['geometry']
      original: Mesh['material']
      casts: boolean
      receives: boolean
    }[] = []
    stood.traverseVisible((node) => {
      if (node instanceof Mesh)
        meshes.push({
          id: node.uuid,
          geometry: node.geometry.clone().applyMatrix4(node.matrixWorld),
          original: node.material,
          casts: node.castShadow,
          receives: node.receiveShadow,
        })
    })
    return meshes
  }, [scene, width, height, depth])
  useEffect(
    () => () => {
      for (const mesh of built) mesh.geometry.dispose()
    },
    [built],
  )
  const materials = useMemo(
    () =>
      built.map(({ original }) => {
        const recolour = (worn: Material) => {
          if (!(worn instanceof MeshStandardMaterial) || !TAKES_THE_SURFACE.test(worn.name))
            return worn
          const painted = worn.clone()
          painted.color.set(paint.colour)
          if (paint.texture) painted.map = textureOf(paint.texture, paint.repeat)
          return painted
        }
        return Array.isArray(original) ? original.map(recolour) : recolour(original)
      }),
    [built, paint.colour, paint.texture, paint.repeat],
  )
  useEffect(
    () => () => {
      materials.forEach((value, i) => {
        const originals = [built[i]!.original].flat()
        for (const material of [value].flat()) if (!originals.includes(material)) material.dispose()
      })
    },
    [built, materials],
  )
  return (
    <>
      {built.map((mesh, i) => (
        <PieceMesh
          key={mesh.id}
          native={{ ...native, id: `${native.id}:${i}` }}
          geometry={mesh.geometry}
          geometryKey={`model:${file}:${width}:${height}:${depth}:${i}`}
          material={materials[i]!}
          at={at}
          rotation={rotation}
          receives={mesh.receives}
          shadows={mesh.casts}
          onPick={onPick}
        />
      ))}
    </>
  )
}
