import { XIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ProjectMeta } from '@/store/projects/db'
import { projectsStore } from '@/store/projects/projects'
import { runProjectAction } from '../project-notices'
import { PlanOutline } from './plan-outline'
import { when } from './when'

export function ProjectCard({ project }: { project: ProjectMeta }) {
  const navigate = useNavigate()

  const forget = async () => {
    await runProjectAction('Could not delete project', async () => {
      const removed = await projectsStore.getState().remove(project.id)
      if (!removed) return
      toast(`${removed.meta.name} deleted`, {
        action: {
          label: 'Undo',
          onClick: () =>
            void runProjectAction('Could not restore project', () =>
              projectsStore.getState().restore(removed),
            ),
        },
      })
    })
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => navigate(`/p/${project.id}`)}
        className="block w-full overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {project.picture ? (
          <img
            src={project.picture}
            alt=""
            draggable={false}
            className="aspect-[4/3] w-full border-b object-cover"
          />
        ) : (
          <div className="aspect-[4/3] border-b bg-background p-4">
            <PlanOutline outline={project.outline} />
          </div>
        )}
        <div className="px-3 py-2.5">
          <div className="truncate text-sm font-medium">{project.name}</div>
          <div className="text-xs text-muted-foreground">{when(project.updatedAt)}</div>
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${project.name}`}
        onClick={forget}
        className="glass absolute top-2 right-2 size-7 rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
      >
        <XIcon />
      </Button>
    </div>
  )
}
