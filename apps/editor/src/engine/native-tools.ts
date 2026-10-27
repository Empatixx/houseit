import { addDimension } from '@houseit/commands/dimensions'
import { typedLength } from '@houseit/commands/length'
import type { Point } from '@houseit/geometry/outlines'
import type { RootState } from '@react-three/fiber'
import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import { type RaycastResult, SnappingClass } from '@thatopen/fragments'
import { toast } from 'sonner'
import { Color, DoubleSide, MeshBasicMaterial, Vector2, Vector3 } from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { engineViewStore, HIDEABLE, type Hideable } from '../store/engine-view'
import { previewStore } from '../store/preview'
import { type Selection, selectionStore } from '../store/selection'
import { shellStore } from '../store/shell'
import { documentStore } from '../store/store'
import { toolStore } from '../store/tool'
import { clearOf, viewStore } from '../store/view'
import type { FragmentDisplay } from './fragment-display'
import { LineDrawing } from './line-drawing'
import { PresentationCamera, PresentationRenderer, PresentationScene } from './presentation-world'

const FACADES: Partial<Record<string, [number, number, number]>> = {
  north: [0, 0, 1],
  south: [0, 0, -1],
  east: [-1, 0, 0],
  west: [1, 0, 0],
}

export let activeTools: NativeTools | null = null
const toolsStore = createStore<{ tools: NativeTools | null }>(() => ({ tools: null }))
export const useNativeTools = () => useStore(toolsStore, (state) => state.tools)

export class NativeTools {
  readonly world
  readonly fragments
  readonly highlighter
  readonly measure
  readonly views
  readonly clips
  private camera: PresentationCamera
  private dead = false
  private running: Promise<void> | null = null
  private stops: (() => void)[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private selecting = 0
  private highlightWork = Promise.resolve()
  private lastView = ''
  private clip: OBF.ClipEdges | undefined
  private lastDoc = documentStore.getState().doc
  private updateRequested = false
  private displayRevision = -1
  private pointerDown = false
  private releasedAt = 0
  private automatic = new Set<OBF.Line>()
  private lines: LineDrawing
  private drawn = ''
  private viewPoint = new Vector3()

  constructor(
    readonly components: OBC.Components,
    readonly display: FragmentDisplay,
    private get: () => RootState,
    private geometryReady: () => boolean,
    private sections: boolean,
  ) {
    this.world = this.components.get(OBC.Worlds).create()
    this.fragments = this.components.get(OBC.FragmentsManager)
    this.highlighter = this.components.get(OBF.Highlighter)
    this.measure = this.components.get(OBF.LengthMeasurement)
    this.views = this.components.get(OBC.Views)
    this.clips = this.components.get(OBF.ClipStyler)
    const { scene, gl, camera } = get()
    this.world.scene = new PresentationScene(this.components, scene)
    this.world.renderer = new PresentationRenderer(this.components, gl)
    this.camera = new PresentationCamera(this.components, camera)
    this.world.camera = this.camera
    this.world.onCameraChanged.add((camera) => {
      get().set({ camera: camera.three as RootState['camera'] })
      for (const model of new Set(this.fragments.list.values())) {
        const assign = model.useCamera.bind(model)
        assign(camera.three as RootState['camera'])
      }
    })
    this.highlighter.setup({
      world: this.world,
      selectMaterialDefinition: null,
      autoHighlightOnClick: false,
    })
    this.highlighter.enabled = true
    this.highlighter.autoToggle.delete('select')
    this.highlighter.zoomToSelection = false
    this.highlighter.multiple = 'none'
    this.measure.world = this.world
    this.measure.units = 'm'
    this.measure.rounding = 2
    this.measure.color = new Color('#714cb6')
    this.measure.lines.onItemAdded.add((line) => {
      Object.assign(line.label.three.element.style, {
        backgroundColor: 'rgba(255,255,255,0.9)',
        color: '#714cb6',
        fontSize: '11px',
        fontWeight: '500',
        lineHeight: '16px',
        padding: '0 4px',
        borderRadius: '4px',
      })
    })
    const resolver = this.components.get(OBC.SnapResolvers).get()
    resolver.precision = 'full'
    resolver.maxDistance = 0.15
    this.views.world = this.world
    this.clips.world = this.world
    this.clips.styles.set('houseit', {
      linesMaterial: new LineMaterial({ color: '#252525', linewidth: 1.5 }),
      fillsMaterial: new MeshBasicMaterial({ color: '#252525', side: DoubleSide }),
    })
    this.stops.push(
      selectionStore.subscribe(() => {
        void this.highlight().catch(this.fail)
      }),
    )
    this.stops.push(
      engineViewStore.subscribe((state, before) => {
        if (state.clear !== before.clear)
          for (const line of this.measure.list)
            if (!this.automatic.has(line)) this.measure.list.delete(line)
        if (state.measure !== before.measure || state.snap !== before.snap) this.configure()
        if (
          state.view !== before.view ||
          state.cutHeight !== before.cutHeight ||
          state.offset !== before.offset ||
          state.lines !== before.lines ||
          state.dimensioning !== before.dimensioning ||
          state.hidden !== before.hidden
        )
          this.request()
      }),
    )
    const canvas = gl.domElement
    const doubleClick = (event: MouseEvent) => {
      if (engineViewStore.getState().measure === 'none') return
      event.preventDefault()
      event.stopPropagation()
      void (async () => {
        if (this.measure.mode === 'edge') {
          if (!this.measure.isDragging) await this.measure.create()
          this.measure.endCreation()
        } else await this.measure.create()
      })().catch(this.fail)
    }
    const press = () => {
      this.pointerDown = true
    }
    const release = () => {
      this.pointerDown = false
      this.releasedAt = performance.now()
    }
    canvas.addEventListener('pointerdown', press, true)
    window.addEventListener('pointerup', release, true)
    window.addEventListener('pointercancel', release, true)
    this.stops.push(() => {
      canvas.removeEventListener('pointerdown', press, true)
      window.removeEventListener('pointerup', release, true)
      window.removeEventListener('pointercancel', release, true)
    })
    canvas.addEventListener('dblclick', doubleClick, true)
    this.stops.push(() => canvas.removeEventListener('dblclick', doubleClick, true))
    this.lines = new LineDrawing(this.components, this.world)
    const place = (event: PointerEvent) => {
      if (!this.lines.placingDimension || event.button !== 0) return
      event.stopPropagation()
      this.lines.step()
    }
    const swallow = (event: MouseEvent) => {
      if (this.lines.placingDimension) event.stopPropagation()
    }
    const stop = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.lines.cancel()) {
        event.stopPropagation()
        if (!this.lines.placingDimension)
          engineViewStore.getState().configure({ dimensioning: false })
      }
    }
    canvas.addEventListener('pointerdown', place, true)
    canvas.addEventListener('click', swallow, true)
    window.addEventListener('keydown', stop, true)
    this.stops.push(() => {
      canvas.removeEventListener('pointerdown', place, true)
      canvas.removeEventListener('click', swallow, true)
      window.removeEventListener('keydown', stop, true)
      this.lines.place(undefined)
    })
    if (!this.sections) {
      const hoverer = this.components.get(OBF.Hoverer)
      hoverer.world = this.world
      hoverer.material = new MeshBasicMaterial({
        color: '#714cb6',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
      hoverer.fadeDuration = 120
      hoverer.enabled = true
      this.stops.push(() => {
        hoverer.enabled = false
        hoverer.clear()
        hoverer.material.dispose()
        hoverer.world = null
      })
    }
    this.components.init()
    activeTools = this
    toolsStore.setState({ tools: this })
    this.stops.push(
      viewStore.subscribe((state, before) => {
        const view = this.views.list.get('houseit-view')
        if (!view?.open) return
        if (state.step !== before.step)
          void view.camera.controls
            .zoomTo(view.camera.three.zoom * state.factor, false)
            .catch(this.fail)
        if (state.asked !== before.asked) void this.frameView(view).catch(this.fail)
      }),
    )
    this.configure()
    this.request()
  }
  get status() {
    return {
      backend: '@thatopen/components',
      busy: this.updateRequested || !!this.running || this.display.busy,
      items: this.display.owners.size,
      wallItems: [...this.display.owners.values()].filter((owner) => owner.kind === 'wall').length,
      surfaceItems: this.display.localIds.size,
      wallBusy: this.display.busy,
      measurements: [...this.measure.list].map((line) => line.value),
      nativeSelection: this.highlighter.selection.select,
      view: engineViewStore.getState().view,
      error: this.display.error ?? engineViewStore.getState().error,
      openViews: [...this.views.list.values()].filter((view) => view.camera === this.world.camera)
        .length,
      sharedCamera: this.world.camera.three === this.get().camera,
    }
  }
  private fail = (error: unknown) => {
    if (this.dead) return
    const message = error instanceof Error ? error.message : String(error)
    engineViewStore.setState({ error: message })
    toast.error(message, { id: 'native-tools' })
  }
  private configure() {
    const settings = engineViewStore.getState()
    if (settings.measure !== 'none') toolStore.getState().arm(null)
    this.measure.enabled = settings.measure !== 'none'
    this.measure.mode = settings.measure === 'edge' ? 'edge' : 'free'
    this.measure.snappings = settings.snap ? [SnappingClass.POINT, SnappingClass.LINE] : []
  }
  frame() {
    if (this.dead) return
    if (!this.views.hasOpenViews && this.camera.three !== this.get().camera)
      this.camera.three = this.get().camera
    if (this.displayRevision !== this.display.revision) this.request()
    if (!this.updateRequested || this.timer || this.running) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      if (
        this.dead ||
        this.running ||
        !this.geometryReady() ||
        this.pointerDown ||
        performance.now() - this.releasedAt < 250 ||
        previewStore.getState().doc
      )
        return
      this.updateRequested = false
      this.running = this.update()
        .catch(this.fail)
        .finally(() => {
          this.running = null
          if (!this.dead) engineViewStore.setState({ busy: false })
        })
    }, 80)
  }
  request() {
    this.updateRequested = true
  }
  private async update() {
    engineViewStore.setState({ busy: true })
    const doc = documentStore.getState().doc
    if (doc !== this.lastDoc) {
      for (const line of this.measure.list)
        if (!this.automatic.has(line)) this.measure.list.delete(line)
      this.lastDoc = doc
    }
    const changed = this.displayRevision !== this.display.revision
    this.displayRevision = this.display.revision
    if (this.dead) return
    if (changed) {
      const classifier = this.components.get(OBC.Classifier)
      classifier.list.delete('Houseit')
      classifier.addGroupItems('Houseit', 'current', {
        [this.display.model?.modelId ?? this.display.id]: this.display.localIds,
      })
      this.components.get(OBC.SnapResolvers).get().clear()
      await this.highlight()
    }
    const changedView = await this.openView()
    if (changed || changedView) await this.clip?.update()
    await this.drawLines(changed || changedView)
    if (!this.sections) await this.applyHidden(changed)
    engineViewStore.setState({ error: null })
  }
  private highlight() {
    const request = ++this.selecting
    this.highlightWork = this.highlightWork.catch(this.fail).then(async () => {
      if (this.dead || request !== this.selecting) return
      await this.highlighter.clear('select')
      const selected = selectionStore.getState().selected
      if (this.dead || request !== this.selecting || !selected) return
      const ids = this.display.ids(selected)
      if (Object.keys(ids).length) await this.highlighter.highlightByID('select', ids, false)
    })
    return this.highlightWork
  }
  select(owner: Selection) {
    selectionStore.getState().select(owner)
    shellStore.getState().showPanel(true)
  }
  async pickAtPointer() {
    if (this.running || this.display.busy || this.dead) return null
    const hit = await this.components.get(OBC.Raycasters).get(this.world).castRay()
    if (!hit || !('localId' in hit) || typeof hit.localId !== 'number') return null
    return this.ownerOf(hit as RaycastResult) ?? null
  }
  private ownerOf(hit: RaycastResult) {
    return hit.fragments?.modelId === this.display.id ||
      hit.fragments?.parentModelId === this.display.id
      ? this.display.owners.get(hit.localId)
      : undefined
  }
  async snapPoint(point: Point, exclude?: Selection): Promise<Point | null> {
    return this.display.query(() => this.snap(point, exclude))
  }
  private async snap(point: Point, exclude?: Selection): Promise<Point | null> {
    if (!engineViewStore.getState().snap || this.running || !this.display.canSnap || this.dead) {
      return null
    }
    const projected = new Vector3(point.x / 1000, 0, -point.y / 1000).project(
      this.world.camera.three,
    )
    const hit = await (this.display.previewing
      ? this.snapPreview(projected, exclude)
      : this.components
          .get(OBC.Raycasters)
          .get(this.world)
          .castRay({
            position: new Vector2(projected.x, projected.y),
            snappingClasses: [SnappingClass.POINT, SnappingClass.LINE],
          })
    ).catch((error) => {
      this.fail(error)
      return null
    })
    if (!hit || !('snappingClass' in hit) || !('localId' in hit) || typeof hit.localId !== 'number')
      return null
    const owner = this.ownerOf(hit as RaycastResult)
    if (owner && exclude && owner.kind === exclude.kind && owner.id === exclude.id) return null
    const result = { x: hit.point.x * 1000, y: -hit.point.z * 1000 }
    if (owner?.kind === 'wall') {
      const doc = documentStore.getState().doc,
        wall = doc.walls[owner.id]
      if (wall) {
        if (
          exclude?.kind === 'wall' &&
          (doc.walls[exclude.id]?.element ?? exclude.id) === (wall.element ?? wall.id)
        )
          return null
        const a = doc.nodes[wall.a]!,
          b = doc.nodes[wall.b]!
        const dx = b.x - a.x,
          dy = b.y - a.y
        const t = Math.max(
          0,
          Math.min(1, ((result.x - a.x) * dx + (result.y - a.y) * dy) / (dx * dx + dy * dy)),
        )
        return { x: a.x + dx * t, y: a.y + dy * t }
      }
    }
    return result
  }
  private async snapPreview(projected: Vector3, exclude?: Selection) {
    const dom = this.get().gl.domElement,
      box = dom.getBoundingClientRect()
    const mouse = new Vector2(
      box.left + ((projected.x + 1) * box.width) / 2,
      box.top + ((1 - projected.y) * box.height) / 2,
    )
    const hits = (
      await Promise.all(
        [...this.display.fragments.list.values()].map((model) =>
          model.raycastWithSnapping({
            camera: this.get().camera,
            dom,
            mouse,
            snappingClasses: [SnappingClass.POINT, SnappingClass.LINE],
          }),
        ),
      )
    ).flatMap((hits) => hits ?? [])
    return (
      hits
        .filter((hit) => {
          if (this.display.transient.has(hit.localId)) return false
          const owner = this.ownerOf(hit)
          return !exclude || !owner || owner.kind !== exclude.kind || owner.id !== exclude.id
        })
        .sort(
          (a, b) =>
            (a.rayDistance ?? Infinity) - (b.rayDistance ?? Infinity) || a.distance - b.distance,
        )[0] ?? null
    )
  }
  dimension(from: Vector3, to: Vector3, edit?: (length: number) => void) {
    const line = new OBF.Line(from, to)
    line.units = 'm'
    line.rounding = 2
    this.automatic.add(line)
    this.measure.list.add(line)
    const drawn = edit
      ? [...this.measure.lines].find(
          (it) =>
            it.line === line || (it.line.start.equals(line.start) && it.line.end.equals(line.end)),
        )
      : undefined
    const release = edit && drawn ? editable(drawn.label.three.element, edit) : undefined
    return () => {
      release?.()
      this.automatic.delete(line)
      this.measure.list.delete(line)
    }
  }
  private hiddenGroups = new Set<Hideable>()
  private async applyHidden(changed: boolean) {
    const wanted = new Set(engineViewStore.getState().hidden)
    const hider = this.components.get(OBC.Hider)
    const finder = this.components.get(OBC.ItemsFinder)
    let touched = false
    for (const group of Object.keys(HIDEABLE) as Hideable[]) {
      const hide = wanted.has(group)
      if (hide === this.hiddenGroups.has(group) && !(hide && changed)) continue
      const items = await finder.getItems([HIDEABLE[group]])
      if (Object.keys(items).length) {
        await hider.set(!hide, items)
        touched = true
      }
      if (hide) this.hiddenGroups.add(group)
      else this.hiddenGroups.delete(group)
    }
    if (touched) await this.fragments.core.update(true)
  }
  private async drawLines(changed: boolean) {
    const { view: name, lines } = engineViewStore.getState()
    const view = this.views.list.get('houseit-view')
    const model = this.display.model
    if (!lines || name === 'plan' || name === 'floor-cut' || !view?.open || !model) {
      this.lines.place(undefined)
      this.lines.clear()
      this.drawn = ''
      return
    }
    const { doc } = documentStore.getState()
    const drawn = Object.values(doc.dimensions ?? {}).filter((it) => it.view === name)
    const key = `${this.lastView}:${this.display.revision}:${JSON.stringify(drawn)}`
    if (!changed && key === this.drawn && this.lines.shown) {
      this.lines.hide(model)
      this.placeDimensions()
      return
    }
    this.drawn = key
    const direction = view.camera.three.getWorldDirection(new Vector3())
    const size = model.box.getSize(new Vector3())
    await this.lines.show(model, {
      direction,
      point: this.viewPoint,
      depth: Math.abs(size.dot(direction)) + 1,
      storeys: Object.values(doc.levels).map((level) => level.elevation / 1000),
      drawn,
    })
    this.placeDimensions()
  }
  private placeDimensions() {
    const { dimensioning, lines, view } = engineViewStore.getState()
    const drawing = view !== 'plan' && view !== 'floor-cut' ? view : undefined
    if (!dimensioning || !lines || !drawing || !this.lines.shown) {
      this.lines.place(undefined)
      return
    }
    this.lines.place((placed) => {
      try {
        documentStore.getState().apply(addDimension, { view: drawing, ...placed })
      } catch (error) {
        this.fail(error)
      }
    })
  }
  drawing() {
    return this.lines.dxf()
  }
  private async openView() {
    if (!this.sections) return false
    const state = engineViewStore.getState(),
      { doc, level } = documentStore.getState()
    const key = `${state.view}:${state.cutHeight}:${state.offset}:${level}`
    if (key === this.lastView) return false
    this.views.close()
    this.clips.list.clear()
    this.views.list.clear()
    this.clip = undefined
    if (state.view === 'plan') {
      this.lastView = key
      return true
    }
    const bounds = this.display.model?.box
    if (!bounds || bounds.isEmpty() || bounds.getSize(new Vector3()).y < 0.05) return false
    this.lastView = key
    const centre = bounds.getCenter(new Vector3())
    const floor = doc.levels[level]!.elevation / 1000
    const facade = FACADES[state.view]
    const normal = facade
      ? new Vector3(...facade)
      : state.view === 'section-x'
        ? new Vector3(-1, 0, 0)
        : state.view === 'section-y'
          ? new Vector3(0, 0, -1)
          : new Vector3(0, -1, 0)
    const point = facade
      ? centre
          .clone()
          .addScaledVector(normal, -(Math.abs(bounds.getSize(new Vector3()).dot(normal)) / 2 + 0.5))
      : state.view === 'section-x'
        ? new Vector3(centre.x + state.offset, centre.y, centre.z)
        : state.view === 'section-y'
          ? new Vector3(centre.x, centre.y, centre.z + state.offset)
          : new Vector3(centre.x, floor + state.cutHeight, centre.z)
    this.viewPoint = point
    const view = this.views.create(normal, point, { id: 'houseit-view', world: this.world })
    view.range =
      state.view === 'floor-cut'
        ? state.cutHeight + 0.3
        : bounds.getSize(new Vector3()).length() + 1
    if (state.view === 'floor-cut') {
      view.camera.three.up.set(0, 0, -1)
      view.camera.controls.updateCameraUp()
      view.update()
    }
    if (!facade) {
      this.clip = this.clips.createFromView(view, {
        id: 'houseit-cut',
        link: false,
        items: { houseit: { style: 'houseit', data: { Houseit: ['current'] } } },
      })
      this.clip.visible = true
    }
    this.views.open(view.id)
    view.camera.controls.mouseButtons.left = 0
    await this.frameView(view)
    await this.fragments.core.update(true)
    return true
  }
  private async frameView(view: OBC.View) {
    const bounds = this.display.model?.box
    if (!bounds || bounds.isEmpty()) return
    await view.camera.controls.fitToBox(bounds, false, {
      paddingTop: 0.5,
      paddingBottom: 0.5,
      paddingLeft: 0.5,
      paddingRight: 0.5,
    })
    view.camera.controls.update(0)
    const { size } = this.get(),
      clear = clearOf(viewStore.getState().covers, size)
    const camera = view.camera.three
    if (camera.type !== 'OrthographicCamera') return
    const ortho = view.camera.threeOrtho
    await view.camera.controls.zoomTo(
      camera.zoom * Math.min(clear.width / size.width, clear.height / size.height),
      false,
    )
    view.camera.controls.update(0)
    const dx = clear.x + clear.width / 2 - size.width / 2,
      dy = clear.y + clear.height / 2 - size.height / 2
    camera.updateMatrixWorld(true)
    const offset = new Vector3()
      .setFromMatrixColumn(camera.matrixWorld, 0)
      .multiplyScalar((-dx * (ortho.right - ortho.left)) / camera.zoom / size.width)
      .add(
        new Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 1)
          .multiplyScalar((dy * (ortho.top - ortho.bottom)) / camera.zoom / size.height),
      )
    const position = view.camera.controls.getPosition(new Vector3()).add(offset),
      target = view.camera.controls.getTarget(new Vector3()).add(offset)
    await view.camera.controls.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      false,
    )
  }
  async dispose() {
    this.dead = true
    clearTimeout(this.timer)
    if (activeTools === this) {
      activeTools = null
      toolsStore.setState({ tools: null })
    }
    for (const stop of this.stops) stop()
    await this.running
    await this.highlightWork.catch(this.fail)
    this.lines.clear()
    this.views.close()
    this.clips.list.clear()
    this.views.list.clear()
    this.world.renderer?.three.clippingPlanes.splice(0)
  }
}

function editable(element: HTMLElement, edit: (length: number) => void) {
  const idle = { pointerEvents: 'auto', cursor: 'text', outline: 'none', boxShadow: '' }
  Object.assign(element.style, idle)
  element.title = 'Click and type a length'
  let shown = ''
  const stop = (event: Event) => event.stopPropagation()
  const open = (event: Event) => {
    event.stopPropagation()
    if (element.isContentEditable) return
    shown = element.textContent ?? ''
    element.contentEditable = 'plaintext-only'
    Object.assign(element.style, { boxShadow: '0 0 0 1.5px #714cb6', backgroundColor: '#fff' })
    element.focus()
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  const close = () => {
    element.contentEditable = 'false'
    Object.assign(element.style, idle, { backgroundColor: 'rgba(255,255,255,0.9)' })
    if (shown) element.textContent = shown
    shown = ''
  }
  const key = (event: KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Escape') element.blur()
    if (event.key !== 'Enter') return
    event.preventDefault()
    const length = typedLength(element.textContent ?? '')
    element.blur()
    if (length !== undefined) edit(length)
  }
  element.addEventListener('pointerdown', stop)
  element.addEventListener('click', open)
  element.addEventListener('keydown', key)
  element.addEventListener('blur', close)
  return () => {
    element.removeEventListener('pointerdown', stop)
    element.removeEventListener('click', open)
    element.removeEventListener('keydown', key)
    element.removeEventListener('blur', close)
  }
}
