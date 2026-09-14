import type { Body, Finish } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { MeshBasicMaterial, PlaneGeometry, type Texture } from 'three'
import { symbolTexture } from '../furniture/symbol-texture'
import { MM } from '../plan-coordinates'
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

  const geometry = useMemo(() => new PlaneGeometry(width * MM, depth * MM), [width, depth])
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
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  if (!texture) return null
  return (
    <PieceMesh
      native={native}
      geometry={geometry}
      geometryKey={`symbol:${width}:${depth}`}
      material={material}
      at={at}
      rotation={[...rotation, 'YXZ']}
      shadows={false}
      onPick={onPick}
    />
  )
}
