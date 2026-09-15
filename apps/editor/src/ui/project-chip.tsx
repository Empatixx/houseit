import { HomeIcon, XIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { projectsStore, useProjects } from '../store/projects/projects'
import { GAP, useLeftEdge } from './edges'
import { useCover } from './use-cover'

export function ProjectChip() {
  const open = useProjects((state) => state.open)
  const left = useLeftEdge()
  const ref = useCover<HTMLDivElement>('top')
  const navigate = useNavigate()

  if (!open) return null

  return (
    <div
      ref={ref}
      style={{ top: GAP, left }}
      className="glass absolute z-30 flex h-10 items-center rounded-xl border transition-[left] duration-200 ease-linear"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Close ${open.name}`}
            onClick={() => {
              void projectsStore
                .getState()
                .closeProject()
                .then(() => navigate('/'))
                .catch(() => undefined)
            }}
            className="group/chip flex h-10 max-w-64 items-center gap-2 rounded-xl px-3 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <HomeIcon className="size-4 shrink-0 text-muted-foreground group-hover/chip:hidden group-focus-visible/chip:hidden" />
            <XIcon className="hidden size-4 shrink-0 group-hover/chip:block group-focus-visible/chip:block" />
            <span className="truncate">{open.name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Close project</TooltipContent>
      </Tooltip>
    </div>
  )
}
