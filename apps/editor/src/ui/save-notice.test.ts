import { act, createElement, type MouseEvent as ReactMouseEvent } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { projectsStore } from '../store/projects/projects'
import { SaveNotice } from './save-notice'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), loading: vi.fn(), success: vi.fn() },
}))

let root: Root
let host: HTMLDivElement
const save = projectsStore.getState().save

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  projectsStore.setState({ saveState: { status: 'saved' }, save })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(createElement(SaveNotice)))
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  projectsStore.setState({ saveState: { status: 'saved' }, save })
  vi.unstubAllGlobals()
})

test('save failure offers retry and updates the same toast when saving succeeds', async () => {
  let finish!: () => void
  const waiting = new Promise<void>((resolve) => {
    finish = resolve
  })
  const retry = vi.fn(async () => {
    projectsStore.setState({ saveState: { status: 'saving' } })
    await waiting
    projectsStore.setState({ saveState: { status: 'saved' } })
  })
  await act(async () => {
    projectsStore.setState({
      save: retry,
      saveState: { status: 'error', message: 'Storage is full' },
    })
  })

  expect(toast.error).toHaveBeenLastCalledWith(
    'Changes not saved',
    expect.objectContaining({
      id: 'project-save',
      duration: Infinity,
      dismissible: false,
    }),
  )
  const action = vi.mocked(toast.error).mock.calls.at(-1)?.[1]?.action
  if (!action || typeof action !== 'object' || !('onClick' in action)) {
    throw new Error('The save error has no retry action')
  }
  expect(action.label).toBe('Retry save')
  const event = new MouseEvent('click', { cancelable: true })
  await act(async () => action.onClick(event as unknown as ReactMouseEvent<HTMLButtonElement>))

  expect(retry).toHaveBeenCalledTimes(1)
  expect(event.defaultPrevented).toBe(true)
  expect(toast.loading).toHaveBeenLastCalledWith(
    'Saving changes…',
    expect.objectContaining({
      id: 'project-save',
      action: undefined,
    }),
  )
  await act(async () => finish())
  expect(toast.success).toHaveBeenLastCalledWith(
    'Changes saved',
    expect.objectContaining({
      id: 'project-save',
      duration: 4000,
      action: undefined,
    }),
  )
})

test('normal autosave stays quiet and warns about unloading only while unsaved', async () => {
  await act(async () => projectsStore.setState({ saveState: { status: 'pending' } }))
  const unsaved = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unsaved)
  expect(unsaved.defaultPrevented).toBe(true)

  await act(async () => projectsStore.setState({ saveState: { status: 'saved' } }))
  const saved = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(saved)
  expect(saved.defaultPrevented).toBe(false)
  expect(toast.error).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})
