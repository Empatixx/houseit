import type { Body, Finish } from '@houseit/scene/pieces'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import type { Texture } from 'three'
import { symbolTexture } from '../furniture/symbol-texture'
import { MM } from '../plan-coordinates'

type SymbolPlateProps = {
  body: Extract<Body, { kind: 'symbol' }>
  paint: Finish
  tint?: string
  at: [number, number, number]
  rotation: [number, number, number]
  onPick?: (event: ThreeEvent<MouseEvent>) => void
}

export function SymbolPlate({ body, paint, tint, at, rotation, onPick }: SymbolPlateProps) {
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

  if (!texture) return null

  return (
    <mesh position={at} rotation={[rotation[0], rotation[1], rotation[2], 'YXZ']} onClick={onPick}>
      <planeGeometry args={[width * MM, depth * MM]} />
      <meshBasicMaterial
        map={texture}
        color={tint ?? '#ffffff'}
        transparent
        alphaTest={0.02}
        depthWrite={false}
      />
    </mesh>
  )
}
