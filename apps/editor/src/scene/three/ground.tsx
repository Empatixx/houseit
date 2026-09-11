import { excavations } from '@houseit/geometry/excavation'
import type { Point } from '@houseit/geometry/outlines'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  BufferAttribute,
  CanvasTexture,
  Path,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
} from 'three'
import { useDocument } from '../../store/store'

const REACH = 400
const TILE = 6
const WEAVE = 2048
const PATCHES = 128
const OVERLAP = 32

type Tone = [number, number, number]

const EARTH: Tone = [52, 60, 34]
const SHADE: Tone = [62, 92, 40]
const BLADE: Tone = [102, 140, 56]
const STRAW: Tone = [162, 174, 94]

const STRANDS = 200000
const TONES = 9

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

  const tuft = field(13, 9137)
  const grain = field(44, 4441)
  const speck = field(160, 7717)

  const picture = ctx.createImageData(WEAVE, WEAVE)
  const pixels = picture.data
  for (let y = 0; y < WEAVE; y++) {
    for (let x = 0; x < WEAVE; x++) {
      const u = x / WEAVE
      const v = y / WEAVE
      const lit = tuft(u, v) * 0.34 + grain(u, v) * 0.36 + speck(u, v) * 0.3
      const soil = mix(EARTH, SHADE, Math.min(1, lit * 1.7))
      const tint = mix(soil, BLADE, Math.max(0, lit - 0.38) * 1.5)
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
    const paint = mix(mix(EARTH, SHADE, 0.5), STRAW, step * step)
    ctx.strokeStyle = `rgb(${paint[0] | 0}, ${paint[1] | 0}, ${paint[2] | 0})`
    ctx.globalAlpha = 0.28 + (1 - step) * 0.24
    ctx.lineWidth = 0.7 + step * 1.1
    ctx.beginPath()
    for (let i = 0; i < STRANDS / TONES; i++) {
      const x = roll() * WEAVE
      const y = roll() * WEAVE
      const lie = grain(x / WEAVE, y / WEAVE)
      const angle = (roll() * 0.7 + lie * 0.3) * Math.PI * 2
      const long = 6 + roll() * 16
      const bend = (roll() - 0.5) * 0.7
      const dx = Math.cos(angle) * long
      const dy = Math.sin(angle) * long
      for (const ox of wraps(x)) {
        for (const oy of wraps(y)) {
          ctx.moveTo(x + ox, y + oy)
          ctx.quadraticCurveTo(
            x + ox + dx * 0.5 - dy * bend * 0.5,
            y + oy + dy * 0.5 + dx * bend * 0.5,
            x + ox + dx,
            y + oy + dy,
          )
        }
      }
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return canvas
}

const TILTS = [0.7, 2.31]

function lawn(holes: Point[][]) {
  const shape = new Shape()
  shape.moveTo(-REACH / 2, -REACH / 2)
  shape.lineTo(REACH / 2, -REACH / 2)
  shape.lineTo(REACH / 2, REACH / 2)
  shape.lineTo(-REACH / 2, REACH / 2)
  shape.closePath()
  for (const ring of holes) {
    const path = new Path()
    ring.forEach((p, i) => {
      if (i === 0) path.moveTo(p.x / 1000, p.y / 1000)
      else path.lineTo(p.x / 1000, p.y / 1000)
    })
    path.closePath()
    shape.holes.push(path)
  }
  const geometry = holes.length
    ? new ShapeGeometry(shape)
    : new PlaneGeometry(REACH, REACH, PATCHES, PATCHES)
  const sweep = field(8, 1277)
  const worn = field(26, 6011)
  const positions = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const colours = new Float32Array(positions.count * 3)
  const askew = (u: number, v: number, tilt: number): [number, number] => [
    u * Math.cos(tilt) - v * Math.sin(tilt),
    u * Math.sin(tilt) + v * Math.cos(tilt),
  ]
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i) / REACH + 0.5
    const v = positions.getY(i) / REACH + 0.5
    uv.setXY(i, u, v)
    const wide = askew(u, v, TILTS[0] ?? 0)
    const close = askew(u, v, TILTS[1] ?? 0)
    const lift = sweep(wide[0], wide[1]) * 0.62 + worn(close[0], close[1]) * 0.38
    const shade = 0.8 + lift * 0.4
    colours[i * 3] = shade * (0.94 + lift * 0.14)
    colours[i * 3 + 1] = shade
    colours[i * 3 + 2] = shade * (1.06 - lift * 0.16)
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  return geometry
}

export function Ground() {
  const gl = useThree((state) => state.gl)
  const doc = useDocument((state) => state.doc)
  const geometry = useMemo(() => lawn(excavations(doc)), [doc])
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
