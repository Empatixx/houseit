import type { Spot } from '@houseit/geometry/standing'
import { useEffect, useRef } from 'react'
import { NativeWorld } from '../engine/native-world'
import { useDocument } from '../store/store'

type CameraViewProps = {
  spot: Spot
  level: string
  onReady: (seen: () => string | undefined) => void
}

export function CameraView({ spot, level, onReady }: CameraViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const runtime = useRef<NativeWorld | null>(null)
  const doc = useDocument((state) => state.doc)
  useEffect(() => {
    if (!container.current) return
    const native = new NativeWorld(container.current, () => {}, { interactive: false })
    runtime.current = native
    return () => {
      runtime.current = null
      void native.dispose()
    }
  }, [])
  useEffect(() => {
    const native = runtime.current
    if (!native) return
    let cancelled = false
    void native.update(doc).then(async () => {
      if (cancelled) return
      const x = spot.at.x / 1000,
        y = (doc.levels[level]!.elevation + 1600) / 1000,
        z = -spot.at.y / 1000
      await native.world.camera.controls.setLookAt(
        x,
        y,
        z,
        x - Math.sin(spot.turn),
        y,
        z - Math.cos(spot.turn),
        false,
      )
      await native.fragments.core.update(true)
      onReady(() => native.picture())
    })
    return () => {
      cancelled = true
    }
  }, [doc, spot, level, onReady])
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted">
      <div className="h-full w-full" ref={container} />
    </div>
  )
}
