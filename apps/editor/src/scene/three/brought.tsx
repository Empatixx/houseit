import type { Finish } from '@houseit/scene/pieces'
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { MM } from '../plan-coordinates'
import { textureOf } from './materials'

const TAKES_THE_SURFACE = /^(body)?$/

type BroughtProps = {
  file: string
  size: { width: number; height: number; depth: number }
  paint: Finish
}

export function Brought({ file, size, paint }: BroughtProps) {
  const { scene } = useGLTF(`/models/${file}`)

  const built = useMemo(() => {
    const model = scene.clone(true)
    model.traverse((node) => {
      if (!(node instanceof Mesh)) return
      const worn = node.material
      if (!(worn instanceof MeshStandardMaterial) || !TAKES_THE_SURFACE.test(worn.name)) return
      const painted = new MeshStandardMaterial()
      painted.copy(worn)
      painted.color.set(paint.colour)
      if (paint.texture) painted.map = textureOf(paint.texture, paint.repeat)
      node.material = painted
    })

    const box = new Box3().setFromObject(model)
    const measured = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    model.position.set(-centre.x, -box.min.y, -centre.z)

    const stood = new Group()
    stood.add(model)
    stood.scale.set(
      measured.x === 0 ? 1 : (size.width * MM) / measured.x,
      measured.y === 0 ? 1 : (size.height * MM) / measured.y,
      measured.z === 0 ? 1 : (size.depth * MM) / measured.z,
    )
    stood.position.y = -(size.height * MM) / 2
    return stood
  }, [scene, size.width, size.height, size.depth, paint.colour, paint.texture, paint.repeat])

  return <primitive object={built} />
}
