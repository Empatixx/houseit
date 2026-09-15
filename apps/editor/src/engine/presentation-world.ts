import * as OBC from '@thatopen/components'
import { type Camera, Scene, Vector2, type WebGLRenderer } from 'three'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

export class PresentationCamera extends OBC.BaseCamera {
  enabled = true
  controls = undefined
  constructor(
    components: OBC.Components,
    public three: Camera,
  ) {
    super(components)
  }
}

export class PresentationScene extends OBC.BaseScene {
  constructor(
    components: OBC.Components,
    public three: Scene,
  ) {
    super(components)
  }
  override dispose() {
    this.onDisposed.trigger()
  }
}

export class PresentationRenderer extends OBC.BaseRenderer {
  enabled = true
  readonly labels = new CSS2DRenderer()
  constructor(
    components: OBC.Components,
    public three: WebGLRenderer,
  ) {
    super(components)
    Object.assign(this.labels.domElement.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    })
    three.domElement.parentElement?.appendChild(this.labels.domElement)
    this.resize()
  }
  getSize() {
    return this.three.getSize(new Vector2())
  }
  resize() {
    const size = this.getSize()
    this.labels.setSize(size.x, size.y)
    this.onResize.trigger(size)
  }
  update() {
    this.onBeforeUpdate.trigger()
    const world = this.currentWorld
    if (world?.scene.three instanceof Scene)
      this.labels.render(world.scene.three, world.camera.three)
    this.onAfterUpdate.trigger()
  }
  dispose() {
    this.labels.domElement.remove()
    this.onDisposed.trigger()
  }
}
