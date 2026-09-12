import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { useGeometryEngine } from './provider'
import type { WallBody } from './wall-body'

export function useWallGeometry(body: WallBody) {
  const engine = useGeometryEngine()
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const key = JSON.stringify(body)
  useEffect(() => () => geometry?.dispose(), [geometry])
  useEffect(() => {
    let live = true
    let made: BufferGeometry | undefined
    void engine
      .wall(body)
      .then((data) => {
        if (!live) return
        made = new BufferGeometry()
        made.setAttribute('position', new Float32BufferAttribute(data.positions, 3))
        made.setAttribute('normal', new Float32BufferAttribute(data.normals, 3))
        made.setAttribute('uv', new Float32BufferAttribute(data.uv, 2))
        for (const group of data.groups)
          made.addGroup(group.start, group.count, group.materialIndex)
        setGeometry(made)
      })
      .catch((error: unknown) => {
        if (live)
          toast.error(error instanceof Error ? error.message : String(error), {
            id: 'geometry-error',
          })
      })
    return () => {
      live = false
    }
  }, [engine, key])
  return geometry
}
