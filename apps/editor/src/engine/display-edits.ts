import { EditRequestType as Edit, type EditRequest, EditUtils } from '@thatopen/fragments'

export function stageDisplayEdit(requests: EditRequest[], retired: Map<number, EditRequest>) {
  return requests.filter((request) => {
    if (request.type !== Edit.DELETE_REPRESENTATION && request.type !== Edit.DELETE_MATERIAL)
      return true
    retired.set(Number(request.localId), request)
    return false
  })
}

export function compactDisplayBuffer(
  base: Uint8Array,
  requests: EditRequest[],
  retired: Iterable<EditRequest>,
  nextId: number,
) {
  const model = EditUtils.getModelFromBuffer(base, true)
  const changes = [...requests, ...retired]
  const create: EditRequest[] = []
  const copy = <T>(
    type:
      | 'ITEM'
      | 'SAMPLE'
      | 'GLOBAL_TRANSFORM'
      | 'LOCAL_TRANSFORM'
      | 'REPRESENTATION'
      | 'MATERIAL',
    values: Map<number, T>,
  ) => {
    EditUtils.applyChangesToRawData(changes, values, type)
    for (const [localId, data] of values)
      create.push({ type: Edit[`CREATE_${type}`], localId, data } as EditRequest)
  }
  copy('ITEM', EditUtils.getItems(model))
  copy('SAMPLE', EditUtils.getSamples(model))
  copy('GLOBAL_TRANSFORM', EditUtils.getGlobalTransforms(model))
  copy('LOCAL_TRANSFORM', EditUtils.getLocalTransforms(model))
  copy('REPRESENTATION', EditUtils.getRepresentations(model))
  copy('MATERIAL', EditUtils.getMaterials(model))
  create.push({ type: Edit.UPDATE_MAX_LOCAL_ID, localId: nextId })
  return EditUtils.edit(
    EditUtils.getModelFromBuffer(EditUtils.newModel({ raw: true }), true),
    create,
    { raw: true, delta: false },
  ).model
}
