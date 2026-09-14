import type { Body, Finish } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { MeshBasicMaterial, type Texture } from 'three'
import { rectangleSheet } from '../../engine/sheet-geometry'
import { useNativeGeometry } from '../../engine/use-wall-geometry'
import { symbolTexture } from '../furniture/symbol-texture'
import { type NativePiece, PieceMesh } from './piece-mesh'

type SymbolPlateProps = {
  native: NativePiece
  body: Extract<Body, { kind: 'symbol' }>
  paint: Finish
  tint?: string
  at: [number, number, number]
  rotation: [number, number, number]
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

export function SymbolPlate({ body, paint, tint, at, rotation, onPick, native }: SymbolPlateProps) {
  const [texture, setTexture] = useState<Texture | undefined>(undefined)
  const { file, width, depth } = body
  const fill = paint.colour

  useEffect(() => {
    let live = true
    symbolTexture(file, fill, { width, depth })
      .then((loaded) => {
        if (live) setTexture(loaded)
      })
      .catch(() => {
        if (live) setTexture(undefined)
      })
    return () => {
      live = false
    }
  }, [file, fill, width, depth])

  const { geometry, key } = useNativeGeometry(rectangleSheet({ width, depth }))
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: texture ?? null,
        color: tint ?? '#ffffff',
        transparent: true,
        alphaTest: 0.02,
        depthWrite: false,
      }),
    [texture, tint],
  )
  useEffect(() => () => material.dispose(), [material])
  if (!texture || !geometry) return null
  return (
    <PieceMesh
      native={native}
      geometry={geometry}
      geometryKey={key}
      material={material}
      at={at}
      rotation={[...rotation, 'YXZ']}
      shadows={false}
      onPick={onPick}
    />
  )
}
