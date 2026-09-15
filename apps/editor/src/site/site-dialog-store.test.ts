import { createEmptyDocument } from '@houseit/core/document'
import type { Site } from '@houseit/core/parcel-site'
import { expect, test } from 'vitest'
import { createSiteDialogStore } from './site-dialog-store'

const site = { parcel: { id: 'parcel-1' } } as Site

test('keeps a parcel selection pending until the picker is confirmed elsewhere', () => {
  const store = createSiteDialogStore()

  store.getState().openFor({ kind: 'create', name: 'On the hill' })
  store.getState().select(site)

  expect(store.getState()).toMatchObject({
    request: { kind: 'create', name: 'On the hill' },
    pending: site,
  })
})

test('closing the picker drops pending state without touching a document', () => {
  const doc = createEmptyDocument()
  const store = createSiteDialogStore()
  store.getState().openFor({ kind: 'attach' }, site)

  store.getState().close()

  expect(store.getState().request).toBeNull()
  expect(store.getState().pending).toBeNull()
  expect(doc.parcelSite).toBeUndefined()
})
