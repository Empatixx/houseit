import { useStore } from 'zustand'
import { documentStore } from '../store'
import { fragmentCodec } from './codec'
import { openProjects } from './db'
import { importLocalPlan } from './import-local'
import { createProjectsStore, type ProjectsState } from './project-store'

export const projectsStore = createProjectsStore(
  async () => {
    const db = await openProjects()
    await importLocalPlan(db)
    return db
  },
  documentStore,
  fragmentCodec(),
)

export function useProjects<T>(selector: (state: ProjectsState) => T): T {
  return useStore(projectsStore, selector)
}
