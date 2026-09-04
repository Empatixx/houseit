import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

/**
 * A plan symbol, drawn onto a texture.
 *
 * The symbols come as line drawings: a white body with a dark line round it and
 * the odd grey accent. What a surface changes is the white — the drawing is the
 * form, the fill is the finish, exactly as a skeleton and its surface are kept
 * apart — so the file is read once, its white swapped for the surface's own
 * colour, and rasterised at a resolution the plan can zoom into.
 */

/** Pixels per millimetre of the thing. A two-metre bed comes out 800 px across. */
const DENSITY = 0.4
/** The longest side of a symbol's texture, so a car does not cost a wall of pixels. */
const LONGEST = 1024

const WHITE = /#ffffff|#fff\b|white/gi

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

/** The white of the drawing becomes the finish; the lines stay the lines. */
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
      // Stretched to the type's size, whatever the drawing's own proportions: the
      // catalogue's size is the contract, and the drawing keeps to it.
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
