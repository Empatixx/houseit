import type { FloorMaterial } from '@houseit/core/floor-materials'
import { RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from 'three'

const loader = new TextureLoader()
const cache = new Map<string, Texture>()

/**
 * The image for a floor material, loaded once and shared by every room using it.
 *
 * The repeat is what keeps the pattern honest: a `ShapeGeometry` built from plan
 * coordinates has UVs in metres, so setting the repeat to one over the material's
 * real size makes a 300 mm tile 300 mm whatever room it lands in — and, because
 * those UVs are the plan's own coordinates, boards run on across a doorway
 * instead of restarting in the next room.
 */
export function floorTexture(material: FloorMaterial): Texture {
  const cached = cache.get(material.id)
  if (cached) return cached

  const texture = loader.load(`textures/${material.texture}`)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  texture.repeat.set(1000 / material.unit.width, 1000 / material.unit.depth)
  cache.set(material.id, texture)
  return texture
}
