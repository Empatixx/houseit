import type { Surface } from '@houseit/core/surfaces'
import { useEffect, useState } from 'react'
import type { Texture } from 'three'
import { EMPHASIS } from '../../store/hover'
import { drawnTexture, type Hatch, symbolTexture } from './symbol-texture'

export const PICKED_HATCH: Hatch = { colour: EMPHASIS.picked.line, spacing: 110, width: 12 }

const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16)

const shade = (fill: string, by: string) =>
  `#${[1, 3, 5]
    .map((at) =>
      Math.round((channel(fill, at) * channel(by, at)) / 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

export const pickedSurface = (surface: Surface): Surface => ({
  ...surface,
  fill: shade(surface.fill, EMPHASIS.picked.tint),
})

export function useSymbol(
  symbol: string | { key: string; svg: string },
  surface: Surface,
  size: { width: number; depth: number },
  hatch?: Hatch,
): Texture | undefined {
  const [texture, setTexture] = useState<Texture | undefined>(undefined)
  const fill = surface.fill
  const drawn = typeof symbol === 'object' ? symbol : undefined
  const file = typeof symbol === 'string' ? symbol : ''

  useEffect(() => {
    let live = true
    if (!file && !drawn) {
      setTexture(undefined)
      return
    }
    const loading = drawn
      ? drawnTexture(drawn.key, drawn.svg, fill, size, hatch)
      : symbolTexture(file, fill, size, hatch)
    loading
      .then((loaded) => {
        if (live) setTexture(loaded)
      })
      .catch(() => {
        if (live) setTexture(undefined)
      })
    return () => {
      live = false
    }
  }, [file, drawn?.key, drawn?.svg, fill, size.width, size.depth, hatch])

  return texture
}
