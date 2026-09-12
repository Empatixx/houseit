import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { Vector3 } from 'three'
import { useView } from '../store/view'

type Controls = { target: Vector3; update: () => void }

export function Spinning() {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as Controls | null
  const spin = useView((state) => state.spin)

  useEffect(() => {
    if (!controls) return
    const turn = (spin * Math.PI) / 180
    camera.up.set(Math.sin(turn), 0, -Math.cos(turn))
    camera.lookAt(controls.target)
    camera.updateProjectionMatrix()
    controls.update()
  }, [spin, camera, controls])

  return null
}
