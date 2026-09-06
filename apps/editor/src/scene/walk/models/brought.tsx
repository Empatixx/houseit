import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { MM } from '../../plan-coordinates'
import type { Part } from './parts'

const TAKES_THE_SURFACE = /^(body)?$/

export function Brought({ file, part }: { file: string; part: Part }) {
  const { scene } = useGLTF(`/models/${file}`)

  const built = useMemo(() => {
    const model = scene.clone(true)
    model.traverse((node) => {
      if (!(node instanceof Mesh)) return
      const worn = node.material
      if (!(worn instanceof MeshStandardMaterial) || !TAKES_THE_SURFACE.test(worn.name)) return
      const painted = new MeshStandardMaterial()
      painted.copy(worn)
      painted.color.set(part.body.color)
      if (part.body.map) painted.map = part.body.map
      node.material = painted
    })

    const box = new Box3().setFromObject(model)
    const size = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    model.position.set(-centre.x, -box.min.y, -centre.z)

    const stood = new Group()
    stood.add(model)
    stood.scale.set(
      size.x === 0 ? 1 : (part.w * MM) / size.x,
      size.y === 0 ? 1 : (part.h * MM) / size.y,
      size.z === 0 ? 1 : (part.d * MM) / size.z,
    )
    return stood
  }, [scene, part.w, part.d, part.h, part.body.color, part.body.map])

  return <primitive object={built} />
}
