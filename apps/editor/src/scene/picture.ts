import type { Extent } from '@houseit/geometry/dimensions'
import type { Room } from '@houseit/geometry/rooms'
import {
  OrthographicCamera,
  type Scene,
  SRGBColorSpace,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { MM } from './plan-coordinates'

const PICTURE = { width: 640, height: 480 }
const PADDING = 0.9
const OVERHEAD = 40
const NAME = '500 22px system-ui, sans-serif'
const AREA = '17px system-ui, sans-serif'
const LINE = 12

type Frame = { centre: { x: number; y: number }; zoom: number }

function framing(extent: Extent): Frame {
  const centre = { x: ((extent.x0 + extent.x1) / 2) * MM, y: ((extent.y0 + extent.y1) / 2) * MM }
  const span = {
    x: Math.max(extent.x1 - extent.x0, 1) * MM,
    y: Math.max(extent.y1 - extent.y0, 1) * MM,
  }
  const zoom = PADDING * Math.min(PICTURE.width / span.x, PICTURE.height / span.y)
  return { centre, zoom }
}

function overhead({ centre, zoom }: Frame): OrthographicCamera {
  const { width, height } = PICTURE
  const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 200)
  camera.position.set(centre.x, OVERHEAD, -centre.y)
  camera.up.set(0, 0, -1)
  camera.lookAt(new Vector3(centre.x, 0, -centre.y))
  camera.zoom = zoom
  camera.updateProjectionMatrix()
  return camera
}

function rendered(gl: WebGLRenderer, scene: Scene, camera: OrthographicCamera): Uint8Array {
  const { width, height } = PICTURE
  const target = new WebGLRenderTarget(width, height, { colorSpace: SRGBColorSpace })
  const pixels = new Uint8Array(width * height * 4)
  const was = gl.getRenderTarget()
  try {
    gl.setRenderTarget(target)
    gl.render(scene, camera)
    gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)
  } finally {
    gl.setRenderTarget(was)
    target.dispose()
  }
  return pixels
}

export function picture(
  gl: WebGLRenderer,
  scene: Scene,
  extent: Extent,
  rooms: Room[],
): string | undefined {
  const { width, height } = PICTURE
  const frame = framing(extent)
  const pixels = rendered(gl, scene, overhead(frame))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return undefined

  const image = context.createImageData(width, height)
  const row = width * 4
  for (let y = 0; y < height; y += 1) {
    image.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row)
  }
  context.putImageData(image, 0, 0)

  const at = (point: { x: number; y: number }) => ({
    x: width / 2 + (point.x * MM - frame.centre.x) * frame.zoom,
    y: height / 2 - (point.y * MM - frame.centre.y) * frame.zoom,
  })
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const room of rooms) {
    if (!room.name) continue
    const spot = at(room.centre)
    context.font = NAME
    context.fillStyle = '#171717'
    context.fillText(room.name, spot.x, spot.y - LINE)
    context.font = AREA
    context.fillStyle = '#737373'
    context.fillText(`${(room.area / 1_000_000).toFixed(1)} m²`, spot.x, spot.y + LINE)
  }
  return canvas.toDataURL('image/jpeg', 0.85)
}
