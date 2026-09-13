import { planExtent } from '@houseit/geometry/dimensions'
import { roomsOf } from '@houseit/geometry/rooms'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useFragmentDisplay } from '../engine/fragment-display-layer'
import { useGeometryEngine } from '../engine/provider'
import { projectsStore } from '../store/projects/projects'
import { documentStore } from '../store/store'
import { picture } from './picture'

const OPENED = 1500
const SETTLED = 1000

export function PlanPicture() {
  const walls = useFragmentDisplay()
  const engine = useGeometryEngine()
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const take = () => {
      if (walls.error) return
      if (walls.busy || engine.status.pending) {
        timer = setTimeout(take, 100)
        return
      }
      const open = projectsStore.getState().open
      if (!open) return
      const { doc, level } = documentStore.getState()
      const extent = planExtent(doc, level)
      if (!extent) return
      let image: string | undefined
      try {
        image = picture(gl, scene, extent, roomsOf(doc, level))
      } catch {
        return
      }
      if (image) void projectsStore.getState().picture(open.id, image)
    }
    let timer = setTimeout(take, OPENED)
    const stop = documentStore.subscribe((state, previous) => {
      if (state.doc === previous.doc && state.level === previous.level) return
      clearTimeout(timer)
      timer = setTimeout(take, SETTLED)
    })
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, [gl, scene, walls, engine])

  return null
}
