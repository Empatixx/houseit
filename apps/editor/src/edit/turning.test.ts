import type { HouseObject } from '@houseit/core/document'
import { beforeEach, expect, test } from 'vitest'
import { previewStore } from '../store/preview'
import { documentStore } from '../store/store'
import { stopTurning, turningTo } from './object-commands'

const floor =
  'add-room --material natural-oak --shape rectangle --width 6m --depth 5m --name obývák'

const camera = (): HouseObject => {
  documentStore.getState().reset()
  documentStore.getState().exec(`${floor}\nadd-object --room obývák --type camera`)
  const { doc } = documentStore.getState()
  return Object.values(doc.objects).find((object) => object.type === 'camera')!
}

beforeEach(() => {
  previewStore.getState().clear()
  stopTurning()
})

test('turning shows the turn in the preview without writing it down', () => {
  const object = camera()

  turningTo(object, 90)

  expect(previewStore.getState().doc?.objects[object.id]?.rotation).toBe(90)
  expect(documentStore.getState().doc.objects[object.id]?.rotation).not.toBe(90)
})

test('a turn that is only previewed is no step to undo', () => {
  const object = camera()
  const steps = documentStore.getState().past.length

  turningTo(object, 45)
  turningTo(object, 120)

  expect(documentStore.getState().past).toHaveLength(steps)
})

test('letting go of the turn puts the preview away', () => {
  const object = camera()
  turningTo(object, 90)

  stopTurning()

  expect(previewStore.getState().doc).toBeNull()
})

test('a turn is taken round the circle, so dragging past north is not refused', () => {
  const object = camera()

  turningTo(object, 400)

  expect(previewStore.getState().doc?.objects[object.id]?.rotation).toBe(40)
})
