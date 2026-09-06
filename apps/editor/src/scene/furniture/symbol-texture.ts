import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

const DENSITY = 0.4
const LONGEST = 1024

const WHITE = /#ffffff|#fff\b|white/i

const cache = new Map<string, Promise<Texture>>()
const sources = new Map<string, Promise<string>>()

function sourceOf(file: string): Promise<string> {
  const cached = sources.get(file)
  if (cached) return cached
  const loading = fetch(`/symbols/${file}`).then((response) => {
    if (!response.ok) throw new Error(`no symbol at symbols/${file}`)
    return response.text()
  })
  sources.set(file, loading)
  return loading
}

export function symbolTexture(
  file: string,
  fill: string,
  size: { width: number; depth: number },
): Promise<Texture> {
  const key = `${file}@${fill}`
  const cached = cache.get(key)
  if (cached) return cached

  const loading = sourceOf(file).then((source) => rasterise(tint(source, fill), size))
  cache.set(key, loading)
  return loading
}

export function drawnTexture(
  key: string,
  svg: string,
  fill: string,
  size: { width: number; depth: number },
): Promise<Texture> {
  const cached = cache.get(`${key}@${fill}`)
  if (cached) return cached

  const drawing = rasterise(tint(svg, fill), size)
  cache.set(`${key}@${fill}`, drawing)
  return drawing
}

function tint(source: string, fill: string): string {
  return source.replace(/fill="([^"]*)"/g, (match, colour: string) =>
    WHITE.test(colour) ? `fill="${fill}"` : match,
  )
}

function rasterise(svg: string, size: { width: number; depth: number }): Promise<Texture> {
  const scale = Math.min(DENSITY, LONGEST / Math.max(size.width, size.depth))
  const width = Math.max(2, Math.round(size.width * scale))
  const height = Math.max(2, Math.round(size.depth * scale))

  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    image.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('no 2d context'))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      texture.anisotropy = 4
      resolve(texture)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('symbol did not draw'))
    }
    image.src = url
  })
}
