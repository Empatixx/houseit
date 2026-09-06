import type { Surface } from '@houseit/core/surfaces'
import { useEffect, useState } from 'react'
import type { Texture } from 'three'
import { drawnTexture, symbolTexture } from './symbol-texture'

export function useSymbol(
  symbol: string | { key: string; svg: string },
  surface: Surface,
  size: { width: number; depth: number },
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
      ? drawnTexture(drawn.key, drawn.svg, fill, size)
      : symbolTexture(file, fill, size)
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
  }, [file, drawn?.key, drawn?.svg, fill, size.width, size.depth])

  return texture
}
