import { GeometryEngine } from '@thatopen/fragments'
import { IfcAPI } from 'web-ifc'
import wasmUrl from 'web-ifc/web-ifc.wasm?url'
import { generateGeometry } from './generate-geometry'
import type { GeometryRequest, GeometryResponse } from './geometry-protocol'

const api = new IfcAPI()
const engine = api.Init(() => wasmUrl, true).then(() => new GeometryEngine(api))
let queue = Promise.resolve()
self.onmessage = (event: MessageEvent<GeometryRequest>) => {
  queue = queue.then(async () => {
    const { id, input } = event.data
    try {
      const geometry = generateGeometry(await engine, input)
      const data = {
        positions: new Float32Array(geometry.getAttribute('position').array),
        normals: new Float32Array(geometry.getAttribute('normal').array),
        uv: new Float32Array(geometry.getAttribute('uv').array),
        groups: geometry.groups,
      }
      geometry.dispose()
      self.postMessage({ id, data } satisfies GeometryResponse, {
        transfer: [data.positions.buffer, data.normals.buffer, data.uv.buffer],
      })
    } catch (error) {
      self.postMessage({
        id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies GeometryResponse)
    }
  })
}
