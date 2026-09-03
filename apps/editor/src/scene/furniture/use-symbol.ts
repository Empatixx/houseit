import type { Surface } from '@houseit/core/surfaces'
import { useEffect, useState } from 'react'
import type { Texture } from 'three'
import { symbolTexture } from './symbol-texture'

/** The rasterised symbol, once it has loaded; nothing until then, and nothing for no symbol. */
export function useSymbol(
  symbol: string,
  surface: Surface,
  size: { width: number; depth: number },
): Texture | undefined {
  const [texture, setTexture] = useState<Texture | undefined>(undefined)
  const fill = surface.fill

  useEffect(() => {
    let live = true
    if (!symbol) {
      setTexture(undefined)
      return
    }
    symbolTexture(symbol, fill, size)
      .then((loaded) => {
        if (live) setTexture(loaded)
      })
      .catch(() => {
        if (live) setTexture(undefined)
      })
    return () => {
      live = false
    }
  }, [symbol, fill, size.width, size.depth])

  return texture
}
