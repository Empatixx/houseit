import { roomsOf } from '@houseit/geometry/rooms'
import { standingAt } from '@houseit/geometry/standing'
import { wallElement } from '@houseit/geometry/wall-elements'
import * as OBC from '@thatopen/components'
import { type Element, type FragmentsModel, SnappingClass } from '@thatopen/fragments'
import { type Group, type Intersection, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { moveTo } from '../edit/object-commands'
import { moveOpeningTo } from '../edit/opening-commands'
import { pick } from '../edit/pick'
import { moveWallBy } from '../edit/wall-commands'
import type { Selection } from '../store/selection'
import { documentStore } from '../store/store'
import { toolStore } from '../store/tool'

type Drag = {
  selected: Selection
  modelId: string
  localId: number
  screen: Vector2
  start: Vector3
  shift: Vector3
  element?: Element
  mesh?: Group
  preparing?: Promise<void>
  moving: boolean
}

export class NativeDragging {
  enabled = false
  snapping = true
  private drag: Drag | null = null
  private sequence = 0
  private snapSequence = 0
  private down = false
  private canvas: HTMLCanvasElement
  constructor(
    private components: OBC.Components,
    private world: OBC.World,
    private owner: (model: string, id: number) => Selection | undefined,
    private error: (message: string) => void,
  ) {
    this.canvas = world.renderer!.three.domElement
    this.canvas.addEventListener('pointerdown', this.start)
    this.canvas.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.end)
    window.addEventListener('pointercancel', this.cancelEvent)
    window.addEventListener('keydown', this.keydown, true)
  }
  private ndc(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    return new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }
  private planePoint(event: PointerEvent) {
    const { doc, level } = documentStore.getState(),
      ray = new Raycaster()
    ray.setFromCamera(this.ndc(event), this.world.camera.three)
    return ray.ray.intersectPlane(
      new Plane(new Vector3(0, 1, 0), -doc.levels[level]!.elevation / 1000),
      new Vector3(),
    )
  }
  private start = (event: PointerEvent) => {
    if (!this.enabled || event.button !== 0 || toolStore.getState().armed) return
    const start = this.planePoint(event)
    if (!start) return
    this.down = true
    const sequence = ++this.sequence
    void this.components
      .get(OBC.Raycasters)
      .get(this.world)
      .castRay({ position: this.ndc(event) })
      .then((result) => {
        const hit = result as (Intersection & { localId: number; fragments: FragmentsModel }) | null
        if (!hit || !this.down || sequence !== this.sequence || hit.localId === undefined) return
        const selected = this.owner(hit.fragments.modelId, hit.localId)
        if (!selected || selected.kind === 'room') return
        pick(selected)
        this.drag = {
          selected,
          modelId: hit.fragments.modelId,
          localId: hit.localId,
          screen: new Vector2(event.clientX, event.clientY),
          start,
          shift: new Vector3(),
          moving: false,
        }
      })
      .catch((error) => this.error(String(error)))
  }
  private async prepare(drag: Drag) {
    const fragments = this.components.get(OBC.FragmentsManager)
    const [element] = await fragments.core.editor.getElements(drag.modelId, [drag.localId])
    if (!element || this.drag !== drag) return
    drag.element = element
    const mesh = await element.getMeshes()
    if (this.drag !== drag) {
      element.disposeMeshes(mesh)
      return
    }
    drag.mesh = mesh
    this.world.scene.three.add(mesh)
    await fragments.list.get(drag.modelId)?.setVisible([drag.localId], false)
    await fragments.core.update(true)
  }
  private move = (event: PointerEvent) => {
    const drag = this.drag
    if (!drag || !this.down) return
    if (!drag.moving && drag.screen.distanceTo(new Vector2(event.clientX, event.clientY)) < 4)
      return
    drag.moving = true
    drag.preparing ??= this.prepare(drag)
    const point = this.planePoint(event)
    if (!point) return
    const apply = (point: Vector3) => {
      if (this.drag !== drag) return
      const shift = point.clone().sub(drag.start)
      shift.y = 0
      if (drag.selected.kind === 'wall') {
        const element = wallElement(documentStore.getState().doc, drag.selected.id)
        const normal = new Vector3(-element.unit.y, 0, -element.unit.x)
        shift.copy(normal.multiplyScalar(shift.dot(normal)))
      }
      drag.shift.copy(shift)
      if (drag.mesh) drag.mesh.position.copy(shift)
    }
    apply(point)
    const snapSequence = ++this.snapSequence
    if (this.snapping)
      void this.components
        .get(OBC.Raycasters)
        .get(this.world)
        .castRay({
          position: this.ndc(event),
          snappingClasses: [SnappingClass.POINT, SnappingClass.LINE],
        })
        .then((hit) => {
          if (snapSequence === this.snapSequence && hit && 'snappingClass' in hit) apply(hit.point)
        })
        .catch((error) => this.error(String(error)))
  }
  private end = () => {
    this.down = false
    const drag = this.drag
    if (!drag) {
      this.sequence++
      return
    }
    void this.finish(drag).catch((error) => this.error(String(error)))
  }
  private async finish(drag: Drag) {
    const commit = drag.moving
    await this.clean(drag)
    if (!commit) return
    const doc = documentStore.getState().doc,
      { selected, shift } = drag
    const delta = { x: shift.x * 1000, y: -shift.z * 1000 }
    if (selected.kind === 'wall' && doc.walls[selected.id])
      moveWallBy(doc.walls[selected.id]!, delta)
    if (selected.kind === 'object') {
      const object = doc.objects[selected.id]
      const room = object && roomsOf(doc, object.level).find((room) => room.id === object.room)
      const spot = object && room && standingAt(doc, object.level, room, object)
      if (object && spot) moveTo(object, { x: spot.at.x + delta.x, y: spot.at.y + delta.y })
    }
    if (selected.kind === 'opening') {
      const opening = doc.openings[selected.id]
      if (!opening) return
      const wall = doc.walls[opening.wall]!,
        a = doc.nodes[wall.a]!,
        b = doc.nodes[wall.b]!
      moveOpeningTo(opening, {
        x: a.x + (b.x - a.x) * opening.t + delta.x,
        y: a.y + (b.y - a.y) * opening.t + delta.y,
      })
    }
  }
  private async clean(drag: Drag) {
    if (this.drag === drag) this.drag = null
    this.sequence++
    await drag.preparing
    if (drag.mesh && drag.element) {
      drag.mesh.removeFromParent()
      drag.element.disposeMeshes(drag.mesh)
    }
    const fragments = this.components.get(OBC.FragmentsManager)
    await fragments.list.get(drag.modelId)?.setVisible([drag.localId], true)
    await fragments.core.update(true)
  }
  private cancelEvent = () => {
    void this.cancel().catch((error) => this.error(String(error)))
  }
  private keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.cancelEvent()
  }
  async cancel() {
    this.down = false
    this.sequence++
    if (this.drag) await this.clean(this.drag)
  }
  async dispose() {
    this.canvas.removeEventListener('pointerdown', this.start)
    this.canvas.removeEventListener('pointermove', this.move)
    window.removeEventListener('pointerup', this.end)
    window.removeEventListener('pointercancel', this.cancelEvent)
    window.removeEventListener('keydown', this.keydown, true)
    await this.cancel()
  }
}
