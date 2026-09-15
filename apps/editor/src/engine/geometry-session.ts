import { GeometryClient } from './geometry-client'

let shared: GeometryClient | undefined
let users = 0

export function acquireGeometry() {
  shared ??= new GeometryClient()
  const engine = shared
  users++
  let live = true
  return {
    engine,
    release() {
      if (!live) return
      live = false
      if (--users === 0) {
        engine.dispose()
        shared = undefined
      }
    },
  }
}
