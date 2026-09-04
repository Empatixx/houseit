import { useEffect } from 'react'
import { projectsStore, useProjects } from '@/store/projects/projects'
import { Logo } from '../logo'
import { NewProjectCard } from './new-project-card'
import { ProjectCard } from './project-card'

/**
 * What the editor opens onto: the plans there are, on the same warm paper the
 * plan itself sits on. One card is one project; the last of them is empty and
 * makes another.
 */
export function Home() {
  const list = useProjects((state) => state.list)

  useEffect(() => {
    void projectsStore.getState().refresh()
  }, [])

  return (
    <div className="min-h-dvh bg-muted">
      <header className="mx-auto flex max-w-5xl items-center gap-2 px-6 pt-6">
        <Logo size={22} />
        <span className="text-sm font-semibold tracking-tight">
          house<span className="text-primary">it</span>
        </span>
      </header>
      <main className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Projects</h1>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
          {list?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {list ? <NewProjectCard /> : null}
        </div>
      </main>
    </div>
  )
}
