import type { FloorMaterial } from '@houseit/core/floor-materials'
import { RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from 'three'

const loader = new TextureLoader()
const cache = new Map<string, Texture>()

export function floorTexture(material: FloorMaterial): Texture {
  const cached = cache.get(material.id)
  if (cached) return cached

  const texture = loader.load(`/textures/${material.texture}`)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  texture.repeat.set(1000 / material.unit.width, 1000 / material.unit.depth)
  cache.set(material.id, texture)
  return texture
}
