import type { HouseDocument } from '@houseit/core/document'
import { elementId } from '@houseit/geometry/wall-elements'
import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import { RenderedFaces, SnappingClass } from '@thatopen/fragments'
import workerUrl from '@thatopen/fragments/worker?url'
import { Box3, Color, DoubleSide, MeshBasicMaterial, Sphere, Vector3 } from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { pick } from '../edit/pick'
import type { EngineTool, EngineView } from '../store/engine-view'
import { projectsStore } from '../store/projects/projects'
import { type Selection, selectionStore } from '../store/selection'
import { shownStore } from '../store/shown'
import { documentStore } from '../store/store'
import { toolStore } from '../store/tool'
import { viewStore } from '../store/view'
import { walkStore } from '../store/walk'
import { FragmentPieces } from './fragment-pieces'
import { FragmentProject } from './fragment-project'
import { NativeDimensions } from './native-dimensions'
import { NativeDragging } from './native-dragging'
import { NativeEditing } from './native-editing'
import { NativeLabels } from './native-labels'

type NativeTool = EngineTool
type NativeView = EngineView
export type NativeState = {
  busy: boolean
  error: string | null
  measurements: number[]
  tool: NativeTool
}

export class NativeWorld {
  readonly components = new OBC.Components()
  readonly world = this.components
    .get(OBC.Worlds)
    .create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.PostproductionRenderer>()
  readonly fragments = this.components.get(OBC.FragmentsManager)
  readonly highlighter = this.components.get(OBF.Highlighter)
  readonly measure = this.components.get(OBF.LengthMeasurement)
  readonly clips = this.components.get(OBF.ClipStyler)
  readonly views = this.components.get(OBC.Views)
  private project: FragmentProject
  private pieces: FragmentPieces
  private dimensions = new NativeDimensions(this.measure)
  private labels: NativeLabels
  private dragging: NativeDragging
  private editing: NativeEditing
  private stops: (() => void)[] = []
  private dead = false
  private requested: HouseDocument | null = null
  private running: Promise<void> | null = null
  private viewRun: Promise<void> = Promise.resolve()
  private doc: HouseDocument | null = null
  private stopSelection: () => void
  private selecting = false
  private selectionRun: Promise<void> = Promise.resolve()
  private first = true
  private view: NativeView = '3d'
  private offset = 1.2
  private level = ''
  private state: NativeState = { busy: false, error: null, measurements: [], tool: 'select' }

  constructor(
    private container: HTMLDivElement,
    private changed: (state: NativeState) => void,
    private options = { interactive: true },
  ) {
    const { world, components, fragments } = this
    world.scene = new OBC.SimpleScene(components)
    world.scene.setup()
    world.scene.three.background = new Color('#f4f4f5')
    world.renderer = new OBF.PostproductionRenderer(components, container)
    world.renderer.showLogo = false
    world.camera = new OBC.OrthoPerspectiveCamera(components)
    fragments.init(workerUrl)
    fragments.core.settings.autoCoordinate = false
    this.project = new FragmentProject(fragments.core)
    this.pieces = new FragmentPieces(fragments.core)
    fragments.list.onItemSet.add(({ value: model }) => {
      if (this.dead) return
      const assignCamera = model.useCamera.bind(model)
      assignCamera(world.camera.three)
      world.scene.three.add(model.object)
    })
    const update = () => {
      if (!this.dead) void fragments.core.update()
    }
    world.camera.controls.addEventListener('update', update)
    world.onCameraChanged.add((camera) => {
      for (const model of fragments.list.values()) {
        const assignCamera = model.useCamera.bind(model)
        assignCamera(camera.three)
      }
      camera.controls.addEventListener('update', update)
      update()
    })
    this.labels = new NativeLabels(world)
    this.dragging = new NativeDragging(
      components,
      world,
      (model, id) => this.owner(model, id),
      (error) => this.report({ error }),
    )
    this.editing = new NativeEditing(
      components,
      world,
      () => this.project.status.walls,
      (error) => this.report({ error }),
    )
    if (options.interactive) this.stops.push(toolStore.subscribe(() => this.setTool('select')))
    if (options.interactive)
      this.stops.push(
        viewStore.subscribe((state, previous) => {
          if (state.asked !== previous.asked) void this.frame()
          if (state.step !== previous.step)
            void world.camera.controls.zoomTo(world.camera.three.zoom * state.factor, true)
          if (state.spin !== previous.spin)
            void world.camera.controls.rotateAzimuthTo((state.spin * Math.PI) / 180, true)
        }),
      )
    if (options.interactive)
      this.stops.push(
        walkStore.subscribe((state, previous) => {
          if (state.inspection && state.inspection !== previous.inspection) {
            this.views.close()
            void world.camera.controls.setLookAt(
              ...state.inspection.at,
              ...state.inspection.target,
              false,
            )
          }
        }),
      )
    this.stops.push(
      shownStore.subscribe(() => {
        void this.visibility()
      }),
    )
    this.views.world = world
    this.clips.world = world
    this.clips.styles.set('houseit-cut', {
      linesMaterial: new LineMaterial({ color: '#353333', linewidth: 1 }),
      fillsMaterial: new MeshBasicMaterial({ color: '#d4cfc5', side: DoubleSide }),
    })
    this.highlighter.setup({
      world,
      selectMaterialDefinition: {
        color: new Color('#8b5cf6'),
        opacity: 1,
        transparent: false,
        renderedFaces: RenderedFaces.TWO,
      },
    })
    this.highlighter.multiple = 'none'
    this.highlighter.events.select!.onHighlight.add((map) => {
      if (this.selecting || this.state.busy || this.state.tool !== 'select') return
      for (const [model, ids] of Object.entries(map))
        for (const id of ids) {
          const owner = this.owner(model, id)
          if (owner) {
            this.selecting = true
            pick(owner)
            this.selecting = false
            return
          }
        }
    })
    this.highlighter.events.select!.onClear.add(() => {
      if (!this.selecting && !this.state.busy) {
        this.selecting = true
        selectionStore.getState().select(null)
        this.selecting = false
      }
    })
    this.stopSelection = options.interactive
      ? selectionStore.subscribe(() => {
          if (!this.selecting) this.syncSelection()
          if (this.doc) this.dimensions.update(this.doc, this.level, this.view === 'plan')
        })
      : () => {}
    this.measure.world = world
    this.measure.units = 'm'
    this.measure.rounding = 3
    this.measure.color = new Color('#6d28d9')
    this.measure.snappings = [SnappingClass.POINT, SnappingClass.LINE]
    this.measure.enabled = false
    const resolver = components.get(OBC.SnapResolvers).get()
    resolver.precision = 'full'
    resolver.maxDistance = 0.15
    const measurements = () =>
      this.report({ measurements: [...this.measure.list].map((line) => line.value) })
    this.measure.list.onItemAdded.add(measurements)
    this.measure.list.onItemDeleted.add(measurements)
    if (options.interactive) container.addEventListener('dblclick', this.doubleClick)
    if (options.interactive) window.addEventListener('keydown', this.keydown, true)
    components.init()
    void world.camera.controls.setLookAt(14, 12, 14, 0, 0, 0, false)
  }

  get status() {
    return {
      ...this.state,
      view: this.view,
      offset: this.offset,
      level: this.level,
      walls: this.project.status.walls,
      models: [...this.fragments.list.keys()],
      selection: this.highlighter.selection.select,
      snap: this.components.get(OBC.SnapResolvers).get().precision,
    }
  }

  update(doc: HouseDocument) {
    if (this.doc && this.doc !== doc) this.clearMeasurements()
    this.requested = doc
    if (!this.running)
      this.running = this.flush().finally(() => {
        this.running = null
        if (this.requested && !this.dead) void this.update(this.requested)
      })
    return this.running
  }

  private async flush() {
    this.report({ busy: true, error: null })
    this.highlighter.enabled = false
    this.editing.setEnabled(false)
    this.dragging.enabled = false
    this.measure.cancelCreation()
    this.measure.enabled = false
    try {
      while (this.requested && !this.dead) {
        const doc = this.requested
        this.requested = null
        await this.project.save(doc)
        if (this.dead) break
        await this.pieces.update(doc)
        this.doc = doc
        this.components.get(OBC.SnapResolvers).get().clear()
      }
      if (this.dead) return
      await this.fragments.core.update(true)
      if (this.first) {
        this.first = false
        await this.frame()
      }
      if (this.view !== '3d') await this.queueView()
      this.syncSelection()
      await this.visibility()
      const open = projectsStore.getState().open
      if (open && this.options.interactive)
        void projectsStore.getState().picture(open.id, this.picture())
    } catch (error) {
      this.report({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (!this.dead) {
        this.report({ busy: false })
        this.setTool(this.state.tool)
      }
    }
  }

  picture() {
    this.world.renderer!.three.render(this.world.scene.three, this.world.camera.three)
    return this.world.renderer!.three.domElement.toDataURL('image/jpeg', 0.8)
  }

  setTool(tool: NativeTool) {
    if (!this.options.interactive) {
      this.highlighter.enabled = false
      return
    }
    this.measure.cancelCreation()
    this.dragging.enabled = tool === 'select' && !this.state.busy && this.view === 'plan'
    this.editing.setEnabled(tool === 'select' && !this.state.busy && this.view === 'plan')
    this.highlighter.enabled = !toolStore.getState().armed && tool === 'select' && !this.state.busy
    this.measure.enabled = (tool === 'length' || tool === 'edge') && !this.state.busy
    if (tool === 'length' || tool === 'edge') this.measure.mode = tool === 'edge' ? 'edge' : 'free'
    this.report({ tool })
  }

  setSnapping(enabled: boolean) {
    this.dragging.snapping = enabled
    this.editing.setSnapping(enabled)
    this.measure.snappings = enabled ? [SnappingClass.POINT, SnappingClass.LINE] : []
  }

  clearMeasurements() {
    this.measure.cancelCreation()
    this.dimensions.clearManual()
    this.report({ measurements: [...this.measure.list].map((line) => line.value) })
  }

  async show(view: NativeView, level: string, offset: number) {
    this.view = view
    this.level = level
    this.offset = offset
    if (this.state.busy) return
    return this.queueView()
  }

  private queueView() {
    this.viewRun = this.viewRun
      .catch(() => {})
      .then(() => this.applyView())
      .catch((error) => {
        if (!this.dead) this.report({ error: String(error) })
      })
    return this.viewRun
  }

  private async applyView() {
    if (this.dead) return
    const { view, level, offset } = this
    this.editing.cancel()
    this.setTool(this.state.tool)
    this.measure.cancelCreation()
    this.views.close()
    if (view === '3d') {
      const inspection = walkStore.getState().inspection
      if (inspection && this.options.interactive)
        await this.world.camera.controls.setLookAt(...inspection.at, ...inspection.target, false)
      await this.visibility()
      await this.fragments.core.update(true)
      return
    }
    const doc = this.doc
    if (!doc) return
    const box = this.bounds(),
      center = box.getCenter(new Vector3())
    const elevation = (doc.levels[level]?.elevation ?? 0) / 1000
    const normal =
      view === 'plan'
        ? new Vector3(0, -1, 0)
        : view === 'section-x'
          ? new Vector3(-1, 0, 0)
          : new Vector3(0, 0, -1)
    const point =
      view === 'plan'
        ? new Vector3(center.x, elevation + offset, center.z)
        : view === 'section-x'
          ? new Vector3(center.x + offset, center.y, center.z)
          : new Vector3(center.x, center.y, center.z + offset)
    const id = `houseit-${view}-${level}`
    this.views.list.delete(id)
    const made = this.views.create(normal, point, { id, world: this.world })
    made.range =
      view === 'plan'
        ? Math.max(0.05, offset + 0.3)
        : Math.max(1, box.getSize(new Vector3()).length() + Math.abs(offset))
    this.clips.createFromView(made, { items: { building: { style: 'houseit-cut' } } })
    this.views.open(id)
    this.world.camera.controls.mouseButtons.left = 0
    await this.visibility()
    await this.world.camera.controls.fitToSphere(box.getBoundingSphere(new Sphere()), false)
    await this.fragments.core.update(true)
  }

  async frame() {
    const box = this.bounds()
    const framed = viewStore.getState().box
    if (framed && this.view === 'plan')
      box.set(
        new Vector3(framed.x0 / 1000, box.min.y, -framed.y1 / 1000),
        new Vector3(framed.x1 / 1000, box.max.y, -framed.y0 / 1000),
      )
    if (box.isEmpty()) return
    await this.world.camera.controls.fitToSphere(box.getBoundingSphere(new Sphere()), false)
    await this.fragments.core.update(true)
  }

  toScreen(x: number, y: number, height = 0) {
    const rect = this.world.renderer!.three.domElement.getBoundingClientRect()
    const point = new Vector3(x / 1000, height / 1000, -y / 1000).project(this.world.camera.three)
    return {
      x: rect.left + ((point.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - point.y) * rect.height) / 2,
    }
  }

  private async visibility() {
    if (this.dead || !this.doc) return
    const shown = shownStore.getState().shown
    this.dimensions.update(this.doc, this.level, this.options.interactive && this.view === 'plan')
    this.labels.update(
      this.doc,
      this.level,
      this.options.interactive && this.view === 'plan' && shown.labels,
    )
    const model = this.fragments.list.get(this.pieces.modelId)
    if (!model) return
    const hide = [...this.pieces.owners]
      .filter(
        ([, owner]) =>
          (owner.kind === 'room' && !shown.floors) || (owner.kind === 'object' && !shown.furniture),
      )
      .map(([id]) => id)
    await model.setVisible(undefined, true)
    if (hide.length) await model.setVisible(hide, false)
    await this.fragments.core.update(true)
  }

  private bounds() {
    const box = new Box3()
    const doc = this.doc
    if (doc)
      for (const wall of Object.values(doc.walls))
        for (const id of [wall.a, wall.b]) {
          const node = doc.nodes[id]!
          const y = (doc.levels[wall.level]!.elevation + wall.baseOffset) / 1000
          box.expandByPoint(new Vector3(node.x / 1000, y, -node.y / 1000))
          box.expandByPoint(new Vector3(node.x / 1000, y + wall.height / 1000, -node.y / 1000))
        }
    if (box.isEmpty()) box.set(new Vector3(-5, 0, -5), new Vector3(5, 3, 5))
    return box
  }

  private owner(model: string, id: number): Selection | undefined {
    if (model.startsWith(this.pieces.modelId)) return this.pieces.owners.get(id)
    const element = Object.entries(this.project.status.walls).find(([, local]) => local === id)?.[0]
    const wall = Object.values(documentStore.getState().doc.walls).find(
      (wall) => elementId(wall) === element,
    )
    return wall ? { kind: 'wall', id: wall.id } : undefined
  }

  private syncSelection() {
    if (!this.options.interactive) return
    this.selectionRun = this.selectionRun
      .catch(() => {})
      .then(async () => {
        if (this.dead) return
        const selected = selectionStore.getState().selected
        const map: OBC.ModelIdMap = {}
        if (selected?.kind === 'wall') {
          const wall = documentStore.getState().doc.walls[selected.id]
          const id = wall && this.project.status.walls[elementId(wall)]
          if (id !== undefined) map.houseit = new Set([id])
        } else if (selected) {
          const ids = [...this.pieces.owners]
            .filter(([, of]) => of.kind === selected.kind && of.id === selected.id)
            .map(([id]) => id)
          if (ids.length) map[this.pieces.modelId] = new Set(ids)
        }
        this.selecting = true
        try {
          await this.highlighter.highlightByID('select', map, true, false)
        } finally {
          this.selecting = false
        }
      })
      .catch((error) => {
        if (!this.dead) this.report({ error: String(error) })
      })
  }

  private doubleClick = () => {
    if ((this.state.tool === 'length' || this.state.tool === 'edge') && !this.state.busy)
      void this.measure.create().catch((error) => this.report({ error: String(error) }))
  }
  private keydown = (event: KeyboardEvent) => {
    if (
      this.state.tool === 'select' ||
      (event.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(event.target.tagName))
    )
      return
    if (event.key === 'Escape' || event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') this.setTool('select')
      else this.measure.delete()
    }
  }
  private report(patch: Partial<NativeState>) {
    this.state = { ...this.state, ...patch }
    if (!this.dead) this.changed(this.state)
  }

  async dispose() {
    this.dead = true
    this.stopSelection()
    for (const stop of this.stops) stop()
    this.editing.dispose()
    await this.dragging.dispose()
    this.labels.dispose()
    this.container.removeEventListener('dblclick', this.doubleClick)
    window.removeEventListener('keydown', this.keydown, true)
    await this.running
    await this.viewRun
    await this.selectionRun
    this.views.close()
    for (const id of [...this.views.list.keys()]) this.views.list.delete(id)
    await this.project.dispose()
    this.components.dispose()
  }
}
