import { addWall } from '@houseit/commands/wall'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { elementId } from '@houseit/geometry/wall-elements'
import type * as OBC from '@thatopen/components'
import { GraphicVertexPicker } from '@thatopen/components-front'
import { SnappingClass } from '@thatopen/fragments'
import { BufferGeometry, Line, LineBasicMaterial, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { placeArmed } from '../edit/place-commands'
import { runEdit } from '../edit/run-edit'
import { documentStore } from '../store/store'
import { toolStore } from '../store/tool'

export class NativeEditing {
  private picker: GraphicVertexPicker
  private start: Vector3 | null = null
  private down: Vector2 | null = null
  private enabled = false
  private snapping = true
  private sequence = 0
  private preview = new Line(
    new BufferGeometry(),
    new LineBasicMaterial({ color: '#8b5cf6', depthTest: false }),
  )
  private stop: () => void
  constructor(
    components: OBC.Components,
    private world: OBC.World,
    private wallItems: () => Record<string, number>,
    private reportError: (error: string) => void,
  ) {
    this.picker = new GraphicVertexPicker(components)
    this.picker.world = world
    this.picker.enabled = false
    this.world.scene.three.add(this.preview)
    this.preview.renderOrder = 100
    const canvas = world.renderer!.three.domElement
    canvas.addEventListener('pointermove', this.move)
    canvas.addEventListener('pointerdown', this.pointerDown)
    canvas.addEventListener('pointerup', this.click)
    window.addEventListener('keydown', this.keydown, true)
    this.stop = toolStore.subscribe(() => {
      this.cancel()
      this.setEnabled(this.enabled)
    })
  }
  setSnapping(value: boolean) {
    this.snapping = value
  }
  setEnabled(value: boolean) {
    this.enabled = value
    this.picker.enabled = value && toolStore.getState().armed !== null
    this.world.renderer!.three.domElement.style.cursor = this.picker.enabled
      ? 'crosshair'
      : 'default'
  }
  cancel() {
    this.start = null
    this.sequence++
    this.preview.visible = false
  }
  private pointerDown = (e: PointerEvent) => {
    this.down = new Vector2(e.clientX, e.clientY)
  }
  private async point(event: PointerEvent) {
    const hit = await this.picker.get({
      snappingClasses: this.snapping ? [SnappingClass.POINT, SnappingClass.LINE] : [],
    })
    const { doc, level } = documentStore.getState()
    let point = hit?.point.clone()
    if (!point) {
      const rect = this.world.renderer!.three.domElement.getBoundingClientRect()
      const ray = new Raycaster()
      ray.setFromCamera(
        new Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.world.camera.three,
      )
      point =
        ray.ray.intersectPlane(
          new Plane(new Vector3(0, 1, 0), -(doc.levels[level]!.elevation / 1000)),
          new Vector3(),
        ) ?? undefined
    }
    if (!point) return null
    point.y = doc.levels[level]!.elevation / 1000 + 0.02
    if (hit && toolStore.getState().armed?.kind === 'wall') {
      const localId = 'localId' in hit ? Number(hit.localId) : undefined
      const element = Object.entries(this.wallItems()).find(([, id]) => id === localId)?.[0]
      if (element) {
        let closest: { point: Vector3; distance: number } | null = null
        for (const wall of Object.values(doc.walls).filter(
          (w) => w.level === level && elementId(w) === element,
        )) {
          const a = doc.nodes[wall.a]!,
            b = doc.nodes[wall.b]!
          const start = new Vector3(a.x / 1000, point.y, -a.y / 1000),
            end = new Vector3(b.x / 1000, point.y, -b.y / 1000)
          const axis = end.clone().sub(start)
          const t = Math.max(0, Math.min(1, point.clone().sub(start).dot(axis) / axis.lengthSq()))
          const center = start.addScaledVector(axis, t),
            distance = center.distanceToSquared(point)
          if (!closest || distance < closest.distance) closest = { point: center, distance }
        }
        if (closest) point = closest.point
      }
    }
    return point
  }
  private move = (event: PointerEvent) => {
    if (!this.picker.enabled || event.buttons) return
    const sequence = ++this.sequence
    void this.point(event)
      .then((point) => {
        if (sequence !== this.sequence || !point) return
        if (this.start) {
          this.preview.geometry.dispose()
          this.preview.geometry = new BufferGeometry().setFromPoints([this.start, point])
          this.preview.visible = true
        }
      })
      .catch((error) => this.reportError(String(error)))
  }
  private click = (event: PointerEvent) => {
    if (
      !this.picker.enabled ||
      event.button !== 0 ||
      !this.down ||
      this.down.distanceTo(new Vector2(event.clientX, event.clientY)) > 4
    )
      return
    const armed = toolStore.getState().armed
    if (!armed) return
    void this.point(event)
      .then((point) => {
        if (!point || !this.enabled || toolStore.getState().armed !== armed) return
        const at = { x: Math.round(point.x * 1000), y: Math.round(-point.z * 1000) }
        if (armed.kind === 'wall') {
          if (!this.start) {
            this.start = point
            return
          }
          const from = { x: Math.round(this.start.x * 1000), y: Math.round(-this.start.z * 1000) }
          if (
            runEdit(() =>
              documentStore
                .getState()
                .apply(addWall, { from: JSON.stringify(from), to: JSON.stringify(at) }),
            )
          )
            this.cancel()
        } else if (armed) {
          const { doc, level } = documentStore.getState()
          const room = roomsOf(doc, level).find((room) =>
            containsPoint(
              room.nodes.map((id) => doc.nodes[id]!),
              at.x,
              at.y,
            ),
          )
          if (room && placeArmed(armed, room, at) && !event.shiftKey) toolStore.getState().arm(null)
        }
      })
      .catch((error) => this.reportError(String(error)))
  }
  private keydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.cancel()
  }
  dispose() {
    this.stop()
    this.cancel()
    this.picker.dispose()
    const canvas = this.world.renderer!.three.domElement
    canvas.removeEventListener('pointermove', this.move)
    canvas.removeEventListener('pointerdown', this.pointerDown)
    canvas.removeEventListener('pointerup', this.click)
    window.removeEventListener('keydown', this.keydown, true)
    this.preview.removeFromParent()
    this.preview.geometry.dispose()
    this.preview.material.dispose()
  }
}
