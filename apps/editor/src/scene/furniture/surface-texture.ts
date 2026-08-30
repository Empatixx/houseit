import type { Surface } from '@houseit/core/surfaces'
import { RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from 'three'

const loader = new TextureLoader()
const cache = new Map<string, Texture>()

/**
 * The image a surface is filled with, or nothing if it is a flat colour.
 *
 * The repeat is set from the surface's own real size, so grain on a table top is
 * the size grain is, rather than being stretched to whatever the table happens to
 * be. Shapes are built in metres, which is what the repeat is against.
 */
export function surfaceTexture(surface: Surface): Texture | undefined {
  if (!surface.texture || !surface.unit) return undefined

  const key = `${surface.texture}@${surface.unit}`
  const cached = cache.get(key)
  if (cached) return cached

  const texture = loader.load(`textures/${surface.texture}`)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  texture.repeat.set(1000 / surface.unit, 1000 / surface.unit)
  cache.set(key, texture)
  return texture
}
