import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import type { Material, Mesh, Object3D } from 'three'

export type Postproduction = OBF.PostproductionRenderer['postproduction']
type Made = new (components: OBC.Components, renderer: OBF.PostproductionRenderer) => Postproduction

let made: Made | undefined

function postproductionClass(): Made {
  if (made) return made
  const components = new OBC.Components()
  const container = document.createElement('div')
  const renderer = new OBF.PostproductionRenderer(components, container, {
    canvas: document.createElement('canvas'),
    antialias: false,
  })
  try {
    renderer.currentWorld = {} as OBC.World
    renderer.onWorldChanged.trigger({ world: renderer.currentWorld, action: 'added' })
    made = renderer.postproduction.constructor as Made
    return made
  } finally {
    renderer.currentWorld = null
    renderer.dispose()
    components.dispose()
  }
}

export function createPostproduction(
  components: OBC.Components,
  renderer: OBC.BaseRenderer,
): Postproduction {
  const Made = postproductionClass()
  return new Made(components, renderer as unknown as OBF.PostproductionRenderer)
}

export function occludeOpaqueOnly(shading: Postproduction, scene: Object3D) {
  const pass = shading.aoPass
  const render = pass.render.bind(pass)
  const hidden: Material[] = []
  pass.render = (...args: Parameters<typeof pass.render>) => {
    scene.traverseVisible((object) => {
      const material = (object as Mesh).material
      for (const each of Array.isArray(material) ? material : material ? [material] : [])
        if (each.transparent && each.visible) {
          each.visible = false
          hidden.push(each)
        }
    })
    try {
      render(...args)
    } finally {
      for (const each of hidden) each.visible = true
      hidden.length = 0
    }
  }
}
