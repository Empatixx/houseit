import { beforeEach, expect, test } from 'vitest'
import { shellStore } from './shell'

beforeEach(() => shellStore.setState({ tab: null, rail: false, panel: true }))

test('nothing is open on the rail until a tab is asked for', () => {
  expect(shellStore.getState().tab).toBeNull()
})

test('asking for a tab opens the panel on it', () => {
  shellStore.getState().showTab('issues')

  expect(shellStore.getState().tab).toBe('issues')
})

test('asking for the tab that is already open folds the panel away', () => {
  shellStore.getState().showTab('issues')
  shellStore.getState().showTab('issues')

  expect(shellStore.getState().tab).toBeNull()
})

test('asking for another tab keeps the panel open and changes what is in it', () => {
  shellStore.getState().showTab('issues')
  shellStore.getState().showTab('plan')

  expect(shellStore.getState().tab).toBe('plan')
})

test('the parcel has its own site tab', () => {
  shellStore.getState().showTab('site')

  expect(shellStore.getState().tab).toBe('site')
})

test('folding the panel away and asking again opens the same tab', () => {
  shellStore.getState().showTab('plan')
  shellStore.getState().showTab('plan')
  shellStore.getState().showTab('plan')

  expect(shellStore.getState().tab).toBe('plan')
})
