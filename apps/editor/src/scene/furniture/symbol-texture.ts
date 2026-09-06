import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

const DENSITY = 0.4
const LONGEST = 1024

const WHITE = /#ffffff|#fff\b|white/i

export type Hatch = { colour: string; spacing: number; width: number }

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
  hatch?: Hatch,
): Promise<Texture> {
  const key = keyOf(file, fill, hatch)
  const cached = cache.get(key)
  if (cached) return cached

  const loading = sourceOf(file).then((source) =>
    rasterise(dressed(source, fill, size, hatch), size),
  )
  cache.set(key, loading)
  return loading
}

export function drawnTexture(
  key: string,
  svg: string,
  fill: string,
  size: { width: number; depth: number },
  hatch?: Hatch,
): Promise<Texture> {
  const cached = cache.get(keyOf(key, fill, hatch))
  if (cached) return cached

  const drawing = rasterise(dressed(svg, fill, size, hatch), size)
  cache.set(keyOf(key, fill, hatch), drawing)
  return drawing
}

const keyOf = (name: string, fill: string, hatch: Hatch | undefined) =>
  hatch ? `${name}@${fill}@${hatch.colour}/${hatch.spacing}/${hatch.width}` : `${name}@${fill}`

const dressed = (
  source: string,
  fill: string,
  size: { width: number; depth: number },
  hatch: Hatch | undefined,
) => (hatch ? hatched(tint(source, fill), source, size, hatch) : tint(source, fill))

function tint(source: string, fill: string): string {
  return source.replace(/fill="([^"]*)"/g, (match, colour: string) =>
    WHITE.test(colour) ? `fill="${fill}"` : match,
  )
}

const round = (value: number) => Math.round(value * 1000) / 1000

export function hatched(
  drawing: string,
  source: string,
  size: { width: number; depth: number },
  hatch: Hatch,
): string {
  const box = /viewBox="\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(source)
  const [x, y, width, height] = box ? box.slice(1, 5).map(Number) : [0, 0, size.width, size.depth]
  const units = (width ?? size.width) / size.width
  const step = round(hatch.spacing * units)
  const line = round(hatch.width * units)
  const root = /<svg\b[^>]*>/.exec(source)?.[0] ?? ''
  const inherited = /\sfill="[^"]*"/.exec(root)?.[0] ?? ''
  const body = source
    .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/<defs\b[\s\S]*?<\/defs>/g, '')
    .replace(/\s(?:id|clip-path|mask|filter)="[^"]*"/g, '')
    .replace(/fill="([^"]*)"/g, (match, colour: string) =>
      colour === 'none'
        ? match
        : WHITE.test(colour) || colour.startsWith('url(')
          ? 'fill="#fff"'
          : 'fill="#000"',
    )
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="#000"')
  const defs = `<defs><pattern id="picked-hatch" patternUnits="userSpaceOnUse" width="${step}" height="${step}" patternTransform="rotate(45)"><rect width="${line}" height="${step}" fill="${hatch.colour}"/></pattern><mask id="picked-mask"><g${inherited}>${body}</g></mask></defs>`
  const overlay = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#picked-hatch)" mask="url(#picked-mask)"/>`
  return drawing
    .replace(/<svg\b[^>]*>/, (tag) => `${tag}${defs}`)
    .replace(/<\/svg>/, `${overlay}</svg>`)
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
