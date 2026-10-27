import * as OBC from '@thatopen/components'
import type { FragmentsModel } from '@thatopen/fragments'
import { LineBasicMaterial, type Vector3 } from 'three'

const INK = '#1f1d1c'
const HIDDEN = '#b9b3aa'

export type Projection = { direction: Vector3; point: Vector3; depth: number }

export class LineDrawing {
  private drawing: OBC.TechnicalDrawing | undefined
  private materials: LineBasicMaterial[] = []
  private hidden: FragmentsModel | undefined
  private work = 0

  constructor(
    private components: OBC.Components,
    private world: OBC.World,
  ) {}

  get shown() {
    return this.drawing !== undefined
  }

  async show(model: FragmentsModel, projection: Projection) {
    const request = ++this.work
    const ids = { [model.modelId]: new Set(await model.getItemsIdsWithGeometry()) }
    if (request !== this.work) return
    const drawing = this.components.get(OBC.TechnicalDrawings).create(this.world)
    const visible = new LineBasicMaterial({ color: INK })
    const hidden = new LineBasicMaterial({ color: HIDDEN, transparent: true, opacity: 0.6 })
    drawing.layers.create('visible', { material: visible })
    drawing.layers.create('hidden', { material: hidden })
    drawing.orientTo(projection.direction)
    drawing.three.position.copy(projection.point).addScaledVector(projection.direction, 0.01)
    drawing.three.updateMatrixWorld(true)
    drawing.far = projection.depth
    await drawing.addProjectionFromItems(ids, { layers: { visible: 'visible', hidden: 'hidden' } })
    drawing.layers.setVisibility('hidden', false)
    if (request !== this.work) {
      drawing.dispose()
      visible.dispose()
      hidden.dispose()
      return
    }
    this.release()
    this.drawing = drawing
    this.materials = [visible, hidden]
    this.hide(model)
  }

  hide(model: FragmentsModel | undefined) {
    if (this.hidden && this.hidden !== model) this.hidden.object.visible = true
    this.hidden = model
    if (model) model.object.visible = false
  }

  clear() {
    this.work++
    this.release()
    if (this.hidden) this.hidden.object.visible = true
    this.hidden = undefined
  }

  dxf(): string {
    if (!this.drawing) throw new Error('open a section or elevation as a line drawing first')
    return this.components
      .get(OBC.DxfManager)
      .exporter.export([{ drawing: this.drawing, viewports: [{}] }])
  }

  private release() {
    this.drawing?.dispose()
    for (const material of this.materials) material.dispose()
    this.drawing = undefined
    this.materials = []
  }
}
