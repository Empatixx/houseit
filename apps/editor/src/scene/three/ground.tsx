import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  BufferAttribute,
  CanvasTexture,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'

const REACH = 400
const TILE = 4
const WEAVE = 1024
const PATCHES = 128
const OVERLAP = 24

type Tone = [number, number, number]

const SHADE: Tone = [44, 62, 30]
const BLADE: Tone = [104, 132, 60]
const STRAW: Tone = [140, 146, 80]

const STRANDS = 24000
const TONES = 7

function rolls(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function field(period: number, seed: number) {
  const roll = rolls(seed)
  const cells = new Float32Array(period * period)
  for (let i = 0; i < cells.length; i++) cells[i] = roll()
  const at = (cx: number, cy: number) =>
    cells[(((cy % period) + period) % period) * period + (((cx % period) + period) % period)] ?? 0
  return (u: number, v: number) => {
    const x = u * period
    const y = v * period
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const near = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx
    const far = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx
    return near + (far - near) * sy
  }
}

const mix = (from: Tone, to: Tone, by: number): Tone => [
  from[0] + (to[0] - from[0]) * by,
  from[1] + (to[1] - from[1]) * by,
  from[2] + (to[2] - from[2]) * by,
]

function turf() {
  const canvas = document.createElement('canvas')
  canvas.width = WEAVE
  canvas.height = WEAVE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const broad = field(4, 3571)
  const clump = field(16, 9137)
  const fleck = field(48, 4441)
  const dry = field(3, 2287)

  const picture = ctx.createImageData(WEAVE, WEAVE)
  const pixels = picture.data
  for (let y = 0; y < WEAVE; y++) {
    for (let x = 0; x < WEAVE; x++) {
      const u = x / WEAVE
      const v = y / WEAVE
      const lit = broad(u, v) * 0.42 + clump(u, v) * 0.36 + fleck(u, v) * 0.22
      const green = mix(SHADE, BLADE, lit * lit * (3 - 2 * lit))
      const tint = mix(green, STRAW, Math.max(0, dry(u, v) - 0.55) * 0.5)
      const at = (y * WEAVE + x) * 4
      pixels[at] = tint[0]
      pixels[at + 1] = tint[1]
      pixels[at + 2] = tint[2]
      pixels[at + 3] = 255
    }
  }
  ctx.putImageData(picture, 0, 0)

  const roll = rolls(8623)
  const wraps = (v: number) => (v < OVERLAP ? [0, WEAVE] : v > WEAVE - OVERLAP ? [0, -WEAVE] : [0])
  ctx.lineCap = 'round'
  for (let tone = 0; tone < TONES; tone++) {
    const step = tone / (TONES - 1)
    const paint = mix(SHADE, STRAW, step)
    ctx.strokeStyle = `rgb(${paint[0] | 0}, ${paint[1] | 0}, ${paint[2] | 0})`
    ctx.globalAlpha = 0.1 + Math.abs(step - 0.5) * 0.22
    ctx.lineWidth = 0.8 + roll() * 0.8
    ctx.beginPath()
    for (let i = 0; i < STRANDS / TONES; i++) {
      const x = roll() * WEAVE
      const y = roll() * WEAVE
      const angle = roll() * Math.PI * 2
      const long = 5 + roll() * 11
      const dx = Math.cos(angle) * long
      const dy = Math.sin(angle) * long
      for (const ox of wraps(x)) {
        for (const oy of wraps(y)) {
          ctx.moveTo(x + ox, y + oy)
          ctx.lineTo(x + dx + ox, y + dy + oy)
        }
      }
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return canvas
}

function lawn() {
  const geometry = new PlaneGeometry(REACH, REACH, PATCHES, PATCHES)
  const sweep = field(8, 1277)
  const worn = field(26, 6011)
  const across = PATCHES + 1
  const colours = new Float32Array(across * across * 3)
  for (let i = 0; i < across * across; i++) {
    const u = (i % across) / PATCHES
    const v = Math.floor(i / across) / PATCHES
    const lift = sweep(u, v) * 0.62 + worn(u, v) * 0.38
    const shade = 0.82 + lift * 0.34
    colours[i * 3] = shade * (0.94 + lift * 0.14)
    colours[i * 3 + 1] = shade
    colours[i * 3 + 2] = shade * (1.06 - lift * 0.16)
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  return geometry
}

export function Ground() {
  const gl = useThree((state) => state.gl)
  const geometry = useMemo(lawn, [])
  const grass = useMemo(() => {
    const texture = new CanvasTexture(turf())
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.colorSpace = SRGBColorSpace
    texture.repeat.set(REACH / TILE, REACH / TILE)
    texture.anisotropy = gl.capabilities.getMaxAnisotropy()
    return texture
  }, [gl])

  return (
    <mesh
      receiveShadow
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
    >
      <meshStandardMaterial map={grass} vertexColors roughness={1} metalness={0} />
    </mesh>
  )
}
