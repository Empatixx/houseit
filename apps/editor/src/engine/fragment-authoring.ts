import { applyScript } from '@houseit/commands/apply-script'
import type { ArgsOf, Touched, TypedCommand } from '@houseit/commands/define-command'
import { type HouseDocument, parseDocument } from '@houseit/core/document'
import {
  EditRequestType as Edit,
  type EditRequest,
  EditUtils,
  SingleThreadedFragmentsModel,
} from '@thatopen/fragments'
import { produce } from 'immer'
import {
  documentFromGraph,
  graphRequests,
  type NativeGraph,
  nativeItems,
  nativeKey,
} from './authoring-graph'

export type DocumentSource = HouseDocument | Uint8Array
export type FragmentSnapshot = {
  base: Uint8Array
  requests: EditRequest[]
  nextId: number
  doc: HouseDocument
}

export class FragmentAuthoring {
  private model: SingleThreadedFragmentsModel
  private boundaries: number[] = [-1]
  private cursor = 0
  private nextId = 1
  private projection: HouseDocument
  private base: Uint8Array

  constructor(source: DocumentSource) {
    this.base = source instanceof Uint8Array ? readArchive(source) : initialModel(source)
    this.model = new SingleThreadedFragmentsModel('houseit-authoring', this.base, true)
    try {
      this.nextId = this.model.getMaxLocalId()
      const graph = this.graph
      this.projection = documentFromGraph(graph)
      if (source instanceof Uint8Array) {
        const transforms = this.model.getGlobalTransforms()
        const geometry = new Set(
          [...this.model.getSamples().values()].map(
            (sample) => transforms.get(sample.item)?.itemId,
          ),
        )
        for (const [id, item] of graph.items)
          if (nativeKey(item)?.startsWith('elements:') && !geometry.has(id))
            throw new Error(`Fragment geometry for ${nativeKey(item)} is missing`)
      }
    } catch (error) {
      this.model.dispose()
      throw error
    }
  }

  get graph(): NativeGraph {
    const base = EditUtils.getModelFromBuffer(this.base, true)
    const items = nativeItems(base)
    EditUtils.applyChangesToRawData(this.model.getRequests().requests, items, 'ITEM')
    return structuredClone({ items, relations: this.model.getRelations() })
  }

  snapshot(): FragmentSnapshot {
    return {
      base: this.base,
      requests: [...this.model.getRequests().requests],
      nextId: this.nextId,
      doc: this.projection,
    }
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
      this.nextId = Math.max(this.nextId, ...this.model.getItemsIds()) + 1
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

function initialModel(doc: HouseDocument) {
  const base = EditUtils.getModelFromBuffer(EditUtils.newModel({ raw: true }), true)
  return EditUtils.edit(
    base,
    [
      ...graphRequests(doc, { items: new Map(), relations: new Map() }, 1),
      { type: Edit.UPDATE_METADATA, localId: 0, data: { houseit: { schema: 2 } } },
    ],
    { raw: true, delta: false },
  ).model
}

function readArchive(buffer: Uint8Array) {
  const base = EditUtils.getModelFromBuffer(buffer, false)
  const metadata = JSON.parse(base.metadata() ?? '{}')
  const authoring = metadata.houseit
  if (authoring?.schema !== 1 && authoring?.schema !== 2)
    throw new Error('This Fragment model has no Houseit authoring data')
  let nextId = base.maxLocalId()
  for (const ids of [
    EditUtils.getItemsIds(base),
    EditUtils.getMaterialsIds(base),
    EditUtils.getRepresentationsIds(base),
    EditUtils.getSamplesIds(base),
    EditUtils.getGlobalTransformsIds(base),
    EditUtils.getLocalTransformsIds(base),
  ])
    for (const id of ids) nextId = Math.max(nextId, id + 1)
  const requests: EditRequest[] = [{ type: Edit.UPDATE_MAX_LOCAL_ID, localId: nextId }]
  if (authoring.schema === 1) {
    const model = new SingleThreadedFragmentsModel('houseit-upgrade', buffer, false)
    try {
      const items = nativeItems(base)
      for (const [wall, id] of Object.entries(authoring.wallItems as Record<string, number>)) {
        const item = items.get(id)
        if (!item) throw new Error(`Fragment wall ${wall} is missing`)
        item.data.HouseitKey = { value: `elements:${wall}` }
      }
      requests.push(
        ...graphRequests(
          parseDocument(authoring.document),
          {
            items,
            relations: model.getRelations(),
          },
          nextId,
        ),
        { type: Edit.UPDATE_METADATA, localId: 0, data: { houseit: { schema: 2 } } },
      )
    } finally {
      model.dispose()
    }
  }
  return EditUtils.edit(base, requests, { raw: true, delta: false }).model
}
