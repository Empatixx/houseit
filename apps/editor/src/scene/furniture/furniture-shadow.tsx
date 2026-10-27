import { drawnPartsOf } from '@houseit/core/footprint'
import type { Layer } from '@houseit/core/object-types'
import { useEffect, useMemo } from 'react'
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry } from 'three'
import { MM, toWorld } from '../plan-coordinates'

const SPREAD = 160
const BLUR = 55
const DENSITY = 0.12
const STRENGTH = 0.32
const LIGHT = { x: 55, y: -80 }
const BELOW = 4

type Size = { width: number; depth: number }

const textures = new Map<string, CanvasTexture>()

function shadowOf(type: string, size: Size): CanvasTexture {
  const key = `${type}@${Math.round(size.width / 20)}x${Math.round(size.depth / 20)}`
  const known = textures.get(key)
  if (known) return known
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(4, Math.round((size.width + 2 * SPREAD) * DENSITY))
  canvas.height = Math.max(4, Math.round((size.depth + 2 * SPREAD) * DENSITY))
  const context = canvas.getContext('2d')!
  context.filter = `blur(${BLUR * DENSITY}px)`
  context.fillStyle = `rgba(28, 24, 20, ${STRENGTH})`
  for (const part of drawnPartsOf(type)) {
    const x = (SPREAD + part.x0 * size.width) * DENSITY
    const y = (SPREAD + part.y0 * size.depth) * DENSITY
    const w = (part.x1 - part.x0) * size.width * DENSITY
    const h = (part.y1 - part.y0) * size.depth * DENSITY
    context.beginPath()
    context.roundRect(x, y, w, h, Math.min(w, h) * 0.12)
    context.fill()
  }
  const texture = new CanvasTexture(canvas)
  textures.set(key, texture)
  return texture
}

export function FurnitureShadow({
  type,
  size,
  at,
  turn,
  height,
  layer,
}: {
  type: string
  size: Size
  at: { x: number; y: number }
  turn: number
  height: number
  layer: Layer
}) {
  const geometry = useMemo(
    () => new PlaneGeometry((size.width + 2 * SPREAD) * MM, (size.depth + 2 * SPREAD) * MM),
    [size.width, size.depth],
  )
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: shadowOf(type, { width: size.width, depth: size.depth }),
        transparent: true,
        depthWrite: false,
      }),
    [type, size.width, size.depth],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  if (layer === 'under') return null
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={toWorld(at.x + LIGHT.x, at.y + LIGHT.y, height - BELOW)}
      rotation={[-Math.PI / 2, 0, turn + Math.PI]}
      renderOrder={1}
      raycast={() => null}
    />
  )
}
