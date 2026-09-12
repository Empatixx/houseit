import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { OrthographicCamera } from 'three'
import { useView, viewStore } from '../store/view'

export const ZOOM = { least: 6, most: 400, step: 1.25 }

export function Zooming() {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { update: () => void } | null
  const step = useView((state) => state.step)
  const done = useRef(0)

  useEffect(() => {
    if (step === done.current) return
    done.current = step
    if (camera.type !== 'OrthographicCamera') return
    const overhead = camera as OrthographicCamera
    const wanted = overhead.zoom * viewStore.getState().factor
    overhead.zoom = Math.min(ZOOM.most, Math.max(ZOOM.least, wanted))
    overhead.updateProjectionMatrix()
    controls?.update()
  }, [step, camera, controls])

  return null
}
