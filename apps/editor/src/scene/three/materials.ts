import type { Finish } from '@houseit/scene/pieces'
import {
  DoubleSide,
  FrontSide,
  type Material,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from 'three'

const MATT = 0.9

const loader = new TextureLoader()
const photos = new Map<string, Texture>()

export function textureOf(path: string, repeat?: { x: number; y: number }): Texture {
  const key = repeat ? `${path}@${repeat.x}x${repeat.y}` : path
  const cached = photos.get(key)
  if (cached) return cached

  const texture = loader.load(path.startsWith('/') ? path : `/textures/${path}`)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  if (repeat) texture.repeat.set(repeat.x, repeat.y)
  photos.set(key, texture)
  return texture
}

const materials = new Map<string, Material>()

const keyOf = (finish: Finish, sided: boolean) =>
  `${finish.colour}|${finish.texture ?? ''}|${finish.repeat?.x ?? 1}:${finish.repeat?.y ?? 1}|${finish.opacity ?? 1}|${finish.roughness ?? MATT}|${finish.glow ?? 0}|${sided}`

export function materialOf(finish: Finish, sided = false): Material {
  const key = keyOf(finish, sided)
  const cached = materials.get(key)
  if (cached) return cached

  const opacity = finish.opacity ?? 1
  const made = new MeshStandardMaterial({
    color: finish.colour,
    map: finish.texture ? textureOf(finish.texture, finish.repeat) : null,
    roughness: finish.roughness ?? MATT,
    metalness: 0,
    emissive: finish.glow ? finish.colour : '#000000',
    emissiveIntensity: finish.glow ?? 0,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    side: sided ? DoubleSide : FrontSide,
  })
  materials.set(key, made)
  return made
}

export const seeThrough = (finish: Finish): boolean => (finish.opacity ?? 1) < 1
