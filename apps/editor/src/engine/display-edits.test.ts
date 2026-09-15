import {
  EditRequestType as Edit,
  type EditRequest,
  EditUtils,
  GeomsFbUtils,
  SingleThreadedFragmentsModel,
} from '@thatopen/fragments'
import { BoxGeometry } from 'three'
import { expect, it } from 'vitest'
import { compactDisplayBuffer, stageDisplayEdit } from './display-edits'

const identity = { position: [0, 0, 0], xDirection: [1, 0, 0], yDirection: [0, 1, 0] }
const representation = (width: number) => {
  const geometry = new BoxGeometry(width, 2, 1)
  try {
    return GeomsFbUtils.representationFromGeometry(geometry)
  } finally {
    geometry.dispose()
  }
}
const widths = (buffer: Uint8Array, ids: number[]) => {
  const model = new SingleThreadedFragmentsModel('display-regression', buffer, true)
  try {
    return ids.map((id) => {
      const geometry = model.getItemsGeometry([id])[0]![0]!
      const x = Array.from(geometry.positions!).filter((_, i) => i % 3 === 0)
      return Math.max(...x) - Math.min(...x)
    })
  } finally {
    model.dispose()
  }
}

it('keeps native delta geometry aligned across replacement, compaction and a second gesture', () => {
  const create: EditRequest[] = [
    {
      type: Edit.CREATE_MATERIAL,
      localId: 1,
      data: { r: 255, g: 255, b: 255, a: 255, renderedFaces: 0, stroke: 0 },
    },
    { type: Edit.CREATE_LOCAL_TRANSFORM, localId: 2, data: identity },
  ]
  for (const [item, width] of [
    [10, 1],
    [20, 2],
    [30, 3],
  ])
    create.push(
      {
        type: Edit.CREATE_ITEM,
        localId: item!,
        data: { category: 'IFCFURNISHINGELEMENT', data: {} },
      },
      {
        type: Edit.CREATE_GLOBAL_TRANSFORM,
        localId: item! + 1,
        data: { ...identity, itemId: item! },
      },
      { type: Edit.CREATE_REPRESENTATION, localId: item! + 2, data: representation(width!) },
      {
        type: Edit.CREATE_SAMPLE,
        localId: item! + 3,
        data: { item: item! + 1, representation: item! + 2, material: 1, localTransform: 2 },
      },
    )
  create.push({ type: Edit.UPDATE_MAX_LOCAL_ID, localId: 40 })
  const base = EditUtils.edit(
    EditUtils.getModelFromBuffer(EditUtils.newModel({ raw: true }), true),
    create,
    { raw: true, delta: false },
  ).model
  const retired = new Map<number, EditRequest>()
  const gesture = stageDisplayEdit(
    [
      {
        type: Edit.UPDATE_GLOBAL_TRANSFORM,
        localId: 11,
        data: { ...identity, position: [1, 0, 0], itemId: 10 },
      },
      {
        type: Edit.UPDATE_GLOBAL_TRANSFORM,
        localId: 21,
        data: { ...identity, position: [4, 0, 0], itemId: 20 },
      },
      { type: Edit.DELETE_REPRESENTATION, localId: 32 },
      { type: Edit.CREATE_REPRESENTATION, localId: 42, data: representation(4) },
      {
        type: Edit.UPDATE_SAMPLE,
        localId: 33,
        data: { item: 31, representation: 42, material: 1, localTransform: 2 },
      },
      { type: Edit.DELETE_REPRESENTATION, localId: 42 },
      { type: Edit.CREATE_REPRESENTATION, localId: 43, data: representation(6) },
      {
        type: Edit.UPDATE_SAMPLE,
        localId: 33,
        data: { item: 31, representation: 43, material: 1, localTransform: 2 },
      },
      { type: Edit.DELETE_REPRESENTATION, localId: 43 },
      { type: Edit.CREATE_REPRESENTATION, localId: 44, data: representation(4) },
      {
        type: Edit.UPDATE_SAMPLE,
        localId: 33,
        data: { item: 31, representation: 44, material: 1, localTransform: 2 },
      },
      { type: Edit.UPDATE_MAX_LOCAL_ID, localId: 50 },
    ],
    retired,
  )
  const delta = EditUtils.edit(EditUtils.getModelFromBuffer(base, true), gesture, {
    raw: true,
    delta: true,
  }).model
  expect(widths(delta, [10, 20, 30])).toEqual([1, 2, 4])
  const saved = compactDisplayBuffer(base, gesture, retired.values(), 50)
  expect(widths(saved, [10, 20, 30])).toEqual([1, 2, 4])
  const stored = EditUtils.getModelFromBuffer(saved, true)
  expect(stored.maxLocalId()).toBe(50)
  expect([...EditUtils.getRepresentationsIds(stored)].sort((a, b) => a - b)).toEqual([12, 22, 44])
  retired.clear()
  const again = stageDisplayEdit(
    [
      {
        type: Edit.UPDATE_GLOBAL_TRANSFORM,
        localId: 11,
        data: { ...identity, position: [2, 0, 0], itemId: 10 },
      },
      { type: Edit.DELETE_REPRESENTATION, localId: 22 },
      { type: Edit.CREATE_REPRESENTATION, localId: 52, data: representation(5) },
      {
        type: Edit.UPDATE_SAMPLE,
        localId: 23,
        data: { item: 21, representation: 52, material: 1, localTransform: 2 },
      },
      { type: Edit.UPDATE_MAX_LOCAL_ID, localId: 60 },
    ],
    retired,
  )
  expect(widths(EditUtils.edit(stored, again, { raw: true, delta: true }).model, [10, 20])).toEqual(
    [1, 5],
  )
  expect(widths(compactDisplayBuffer(saved, again, retired.values(), 60), [10, 20, 30])).toEqual([
    1, 5, 4,
  ])
})
