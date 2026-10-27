import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import type { FragmentsModel } from '@thatopen/fragments'
import { Box3, LineBasicMaterial, LineSegments, Vector3 } from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

const INK = '#1f1d1c'
const HIDDEN = '#b9b3aa'

const GAP = 0.7
const LOADING = 3000

type Millimetres = { x: number; y: number; z: number }
type Drawn = { id: string; from: Millimetres; to: Millimetres; offset: number }
export type Projection = {
  direction: Vector3
  point: Vector3
  depth: number
  storeys: number[]
  drawn: Drawn[]
}
export type Placed = { from: Millimetres; to: Millimetres; offset: number }

const toThree = ({ x, y, z }: Millimetres) => new Vector3(x / 1000, z / 1000, -y / 1000)
const fromThree = ({ x, y, z }: Vector3): Millimetres => ({
  x: Math.round(x * 1000),
  y: Math.round(-z * 1000),
  z: Math.round(y * 1000),
})

export class LineDrawing {
  private drawing: OBC.TechnicalDrawing | undefined
  private materials: LineBasicMaterial[] = []
  private hidden: FragmentsModel | undefined
  private work = 0
  private placing: ((placed: Placed) => void) | undefined
  private sourced = false
  private ours = new Set<string>()

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
    model.object.visible = true
    await this.loaded(model)
    if (request !== this.work) {
      drawing.dispose()
      visible.dispose()
      hidden.dispose()
      return
    }
    await drawing.addProjectionFromItems(ids, { layers: { visible: 'visible', hidden: 'hidden' } })
    drawing.layers.setVisibility('hidden', false)
    this.dimension(drawing, projection)
    for (const drawn of projection.drawn) {
      const a = drawing.three.worldToLocal(toThree(drawn.from)).setY(0)
      const b = drawing.three.worldToLocal(toThree(drawn.to)).setY(0)
      this.mark(drawing, a, b, drawn.offset / 1000)
    }
    if (request !== this.work) {
      this.annotations.clear([drawing])
      drawing.dispose()
      visible.dispose()
      hidden.dispose()
      return
    }
    this.release()
    this.hidden = undefined
    this.drawing = drawing
    this.materials = [visible, hidden]
    this.hide(model)
    if (this.placing && this.editor.activeDrawing !== drawing) this.editor.activeDrawing = drawing
  }

  private get editor() {
    return this.components.get(OBF.DrawingEditor)
  }

  get placingDimension() {
    return this.placing !== undefined
  }

  place(placed: ((placed: Placed) => void) | undefined) {
    const editor = this.editor
    const tool = editor.use(OBF.LinearAnnotationsTool)
    if (!this.sourced) {
      editor.setSource(this.world)
      tool.system.onCommit.add((committed) => {
        for (const { drawing, item } of committed) {
          if (this.ours.has(item.uuid) || drawing !== this.drawing) continue
          const from = fromThree(drawing.three.localToWorld(item.pointA.clone()))
          const to = fromThree(drawing.three.localToWorld(item.pointB.clone()))
          tool.system.delete(drawing, [item.uuid])
          this.placing?.({ from, to, offset: Math.round(item.offset * 1000) })
        }
      })
      this.sourced = true
    }
    const was = this.placing !== undefined
    this.placing = placed
    const drawing = placed ? (this.drawing ?? null) : null
    if (editor.activeDrawing !== drawing) editor.activeDrawing = drawing
    if (was !== (placed !== undefined))
      editor.activeTool = placed ? OBF.LinearAnnotationsTool : null
  }

  step() {
    if (this.placing) this.editor.step()
  }

  cancel() {
    if (!this.placing) return false
    const tool = this.editor.use(OBF.LinearAnnotationsTool)
    if (tool.isIdle) this.place(undefined)
    else this.editor.cancel()
    return true
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

  private async loaded(model: FragmentsModel) {
    const fragments = this.components.get(OBC.FragmentsManager)
    const started = performance.now()
    do {
      await fragments.core.update(true)
      await new Promise((resolve) => setTimeout(resolve, 50))
    } while (model.isBusy && performance.now() - started < LOADING)
  }

  private get annotations() {
    return this.components.get(OBC.TechnicalDrawings).use(OBC.LinearAnnotations)
  }

  private dimension(drawing: OBC.TechnicalDrawing, projection: Projection) {
    const box = new Box3()
    for (const child of drawing.three.children)
      if (child instanceof LineSegments && child.visible) {
        child.geometry.computeBoundingBox()
        box.union(child.geometry.boundingBox!)
      }
    if (box.isEmpty()) return
    const height = (world: number) =>
      drawing.three.worldToLocal(projection.point.clone().setY(world)).z
    const up = Math.sign(height(1) - height(0)) || 1
    const bottom = up > 0 ? box.min.z : box.max.z
    const top = up > 0 ? box.max.z : box.min.z
    const right = box.max.x
    const add = (a: Vector3, b: Vector3, outward: Vector3, gap: number) => {
      const along = b.clone().sub(a)
      const across = new Vector3(-along.z, 0, along.x).normalize()
      this.mark(drawing, a, b, gap * (across.dot(outward) < 0 ? -1 : 1))
    }
    const down = new Vector3(0, 0, -up)
    const outside = new Vector3(1, 0, 0)
    add(new Vector3(box.min.x, 0, bottom), new Vector3(box.max.x, 0, bottom), down, GAP)
    const levels = [...new Set([bottom, ...projection.storeys.map(height), top])]
      .filter((z) => (z - bottom) * up >= -0.001 && (top - z) * up >= -0.001)
      .sort((a, b) => (a - b) * up)
    if (levels.length > 2)
      for (let i = 0; i + 1 < levels.length; i++)
        add(new Vector3(right, 0, levels[i]!), new Vector3(right, 0, levels[i + 1]!), outside, GAP)
    add(
      new Vector3(right, 0, bottom),
      new Vector3(right, 0, top),
      outside,
      levels.length > 2 ? 2 * GAP : GAP,
    )
  }

  private mark(drawing: OBC.TechnicalDrawing, a: Vector3, b: Vector3, offset: number) {
    const along = b.clone().sub(a)
    if (along.length() < 1e-6) return
    const across = new Vector3(-along.z, 0, along.x).normalize()
    const item = this.annotations.add(drawing, { pointA: a, pointB: b, offset, style: 'default' })
    this.ours.add(item.uuid)
    const label = document.createElement('div')
    label.textContent = along.length().toFixed(2)
    Object.assign(label.style, {
      font: '500 11px/16px ui-sans-serif, system-ui, sans-serif',
      color: INK,
      background: 'rgba(255,255,255,0.92)',
      padding: '0 4px',
      borderRadius: '4px',
      fontVariantNumeric: 'tabular-nums',
      pointerEvents: 'none',
    })
    const mark = new CSS2DObject(label)
    mark.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(across, offset)
    drawing.three.add(mark)
  }

  private release() {
    if (this.drawing) {
      this.annotations.clear([this.drawing])
      for (const mark of this.drawing.three.children.filter((it) => it instanceof CSS2DObject)) {
        mark.element.remove()
        mark.removeFromParent()
      }
    }
    this.drawing?.dispose()
    for (const material of this.materials) material.dispose()
    this.drawing = undefined
    this.materials = []
  }
}
