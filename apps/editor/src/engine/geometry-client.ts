import type {
  GeometryData,
  GeometryInput,
  GeometryRequest,
  GeometryResponse,
} from './geometry-protocol'
import type { WallBody } from './wall-body'

export class GeometryClient {
  private worker = new Worker(new URL('./geometry-worker.ts', import.meta.url), { type: 'module' })
  private next = 0
  private completed = 0
  private failure: Error | undefined

  get status() {
    return {
      backend: '@thatopen/fragments GeometryEngine',
      pending: this.pending.size,
      completed: this.completed,
    }
  }
  private pending = new Map<
    number,
    { resolve: (data: GeometryData) => void; reject: (error: Error) => void }
  >()
  private cache = new Map<string, Promise<GeometryData>>()

  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<GeometryResponse>) => {
      const request = this.pending.get(data.id)
      this.pending.delete(data.id)
      this.completed++
      if ('error' in data) request?.reject(new Error(data.error))
      else request?.resolve(data.data)
    }
    this.worker.onerror = (event) => this.fail(new Error(event.message || 'Geometry worker failed'))
  }

  wall(body: WallBody): Promise<GeometryData> {
    return this.geometry({ kind: 'wall', body })
  }

  geometry(input: GeometryInput): Promise<GeometryData> {
    if (this.failure) return Promise.reject(this.failure)
    const key = JSON.stringify(input)
    const cached = this.cache.get(key)
    if (cached) return cached
    const id = ++this.next
    const result = new Promise<GeometryData>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, input } satisfies GeometryRequest)
    })
    this.cache.set(key, result)
    if (this.cache.size > 256) this.cache.delete(this.cache.keys().next().value!)
    void result.catch(() => this.cache.delete(key))
    return result
  }

  dispose() {
    this.worker.terminate()
    this.fail(new Error('Geometry engine disposed'))
    this.cache.clear()
  }

  private fail(error: Error) {
    this.failure = error
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
  }
}
