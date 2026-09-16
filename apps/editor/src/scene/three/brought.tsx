import type { Finish } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import { use, useEffect, useMemo } from 'react'
import { type Material, MeshStandardMaterial } from 'three'
import { loadModel, modelGeometry } from '../../engine/model-geometry'
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
  const { scene } = use(loadModel(file))
  const { width, height, depth } = size
  const built = useMemo(
    () => modelGeometry(scene, { width, height, depth }),
    [scene, width, height, depth],
  )
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
          if (paint.texture && worn.userData.houseitTexture !== 'tint')
            painted.map = textureOf(paint.texture, paint.repeat)
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
