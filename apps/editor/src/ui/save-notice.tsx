import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { projectsStore, useProjects } from '../store/projects/projects'

const SAVE_TOAST = 'project-save'

export function SaveNotice() {
  const state = useProjects((project) => project.saveState)
  const announced = useRef(false)

  useEffect(() => {
    if (state.status === 'error') {
      announced.current = true
      toast.error('Changes not saved', {
        id: SAVE_TOAST,
        description: 'Your latest changes are still in this tab. Try saving again before leaving.',
        duration: Infinity,
        dismissible: false,
        closeButton: false,
        action: {
          label: 'Retry save',
          onClick: (event) => {
            event.preventDefault()
            void projectsStore
              .getState()
              .save()
              .catch(() => undefined)
          },
        },
      })
    } else if (announced.current && state.status === 'saving') {
      toast.loading('Saving changes…', {
        id: SAVE_TOAST,
        duration: Infinity,
        dismissible: false,
        closeButton: false,
        action: undefined,
      })
    } else if (announced.current && state.status === 'saved') {
      announced.current = false
      toast.success('Changes saved', {
        id: SAVE_TOAST,
        description: 'Your latest changes are saved on this device.',
        duration: 4000,
        dismissible: true,
        closeButton: true,
        action: undefined,
      })
    }
  }, [state])

  useEffect(() => {
    if (state.status === 'saved') return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state.status])

  return null
}
