import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { GeometryInput } from './geometry-protocol'
import { useGeometryEngine } from './provider'
import type { WallBody } from './wall-body'

export function useWallGeometry(body: WallBody) {
  return useNativeGeometry({ kind: 'wall', body }).geometry
}

export function useNativeGeometry(input: GeometryInput | null) {
  const engine = useGeometryEngine()
  const [result, setResult] = useState<{ geometry: BufferGeometry; key: string } | null>(null)
  const key = JSON.stringify(input)
  useEffect(() => () => result?.geometry.dispose(), [result])
  useEffect(() => {
    if (!input) return
    let live = true
    let made: BufferGeometry | undefined
    void engine
      .geometry(input)
      .then((data) => {
        if (!live) return
        made = new BufferGeometry()
        made.setAttribute('position', new Float32BufferAttribute(data.positions, 3))
        made.setAttribute('normal', new Float32BufferAttribute(data.normals, 3))
        made.setAttribute('uv', new Float32BufferAttribute(data.uv, 2))
        for (const group of data.groups)
          made.addGroup(group.start, group.count, group.materialIndex)
        setResult({ geometry: made, key })
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
  return (input && result) || { geometry: null, key }
}
