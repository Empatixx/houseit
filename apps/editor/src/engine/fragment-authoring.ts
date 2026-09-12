import { applyScript } from '@houseit/commands/apply-script'
import type { ArgsOf, Touched, TypedCommand } from '@houseit/commands/define-command'
import type { HouseDocument } from '@houseit/core/document'
import { EditUtils, SingleThreadedFragmentsModel } from '@thatopen/fragments'
import { produce } from 'immer'
import { documentFromGraph, graphRequests, type NativeGraph } from './authoring-graph'

export class FragmentAuthoring {
  private model: SingleThreadedFragmentsModel
  private boundaries: number[] = [-1]
  private cursor = 0
  private nextId = 1
  private projection: HouseDocument

  constructor(doc: HouseDocument) {
    const base = EditUtils.getModelFromBuffer(EditUtils.newModel({ raw: true }), true)
    const requests = graphRequests(doc, { items: new Map(), relations: new Map() }, 1)
    const { model } = EditUtils.edit(base, requests, { raw: true })
    this.model = new SingleThreadedFragmentsModel('houseit-authoring', model, true)
    this.nextId = this.model.getMaxLocalId()
    this.projection = documentFromGraph(this.graph)
  }

  get graph(): NativeGraph {
    const base = EditUtils.getModelFromBuffer(new Uint8Array(this.model.getBuffer(true)), true)
    const items = EditUtils.getItems(base)
    EditUtils.applyChangesToRawData(this.model.getRequests().requests, items, 'ITEM')
    return structuredClone({ items, relations: this.model.getRelations() })
  }

  get document() {
    return this.projection
  }

  get history() {
    return {
      past: this.boundaries.slice(1, this.cursor + 1),
      future: this.boundaries.slice(this.cursor + 1),
      canUndo: this.cursor > 0,
      canRedo: this.cursor + 1 < this.boundaries.length,
    }
  }

  exec(source: string, level: string): Touched {
    let touched: Touched = { changed: [], shown: [] }
    const doc = produce(this.projection, (draft) => {
      touched = applyScript(draft, source, level)
    })
    this.commit(doc)
    return touched
  }

  apply<C extends TypedCommand>(command: C, args: ArgsOf<C>, level: string): Touched {
    let touched: Touched = { changed: [], shown: [] }
    const doc = produce(this.projection, (draft) => {
      const said = command.apply(draft, args, level)
      touched = {
        changed: said?.changed ?? [],
        shown: said?.shown ?? [],
        ...(said?.at === undefined ? {} : { at: said.at }),
        ...(said?.notes === undefined ? {} : { notes: said.notes }),
      }
    })
    this.commit(doc)
    return touched
  }

  private commit(doc: HouseDocument) {
    if (doc === this.projection) return
    const requests = graphRequests(doc, this.graph, this.nextId)
    if (!requests.length) return
    const previous = this.model.getRequests()
    const checkpoint = {
      requests: previous.requests.slice(),
      undoneRequests: previous.undoneRequests.slice(),
    }
    try {
      this.model.setRequests({ undoneRequests: [] })
      this.model.edit(requests)
      const projection = documentFromGraph(this.graph)
      this.nextId = Math.max(this.nextId, ...this.graph.items.keys()) + 1
      this.boundaries = [
        ...this.boundaries.slice(0, this.cursor + 1),
        this.model.getRequests().requests.length - 1,
      ]
      this.cursor++
      this.projection = projection
    } catch (error) {
      this.model.setRequests(checkpoint)
      throw error
    }
  }

  undo() {
    if (this.history.canUndo) this.select(this.cursor - 1)
  }
  redo() {
    if (this.history.canRedo) this.select(this.cursor + 1)
  }

  private select(cursor: number) {
    this.model.selectRequest(this.boundaries[cursor]!)
    try {
      this.projection = documentFromGraph(this.graph)
      this.cursor = cursor
    } catch (error) {
      this.model.selectRequest(this.boundaries[this.cursor]!)
      throw error
    }
  }

  dispose() {
    this.model.dispose()
  }
}
