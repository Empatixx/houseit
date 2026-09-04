import { HomeIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useProjects } from '../store/projects/projects'
import { GAP, useLeftEdge } from './edges'
import { useCover } from './use-cover'

/**
 * Which plan this is, and the way out of it.
 *
 * It stands to the right of the rail and moves with it, so nothing it does can
 * shift the plan. The mark on it is a house until the pointer is over it and a
 * cross once it is: one thing to click, saying both where clicking goes and
 * that the project is being left.
 */
export function ProjectChip() {
  const open = useProjects((state) => state.open)
  const left = useLeftEdge()
  const ref = useCover<HTMLDivElement>('top')
  const [leaving, setLeaving] = useState(false)
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
            onClick={() => navigate('/')}
            onPointerEnter={() => setLeaving(true)}
            onPointerLeave={() => setLeaving(false)}
            onFocus={() => setLeaving(true)}
            onBlur={() => setLeaving(false)}
            className="flex h-10 max-w-64 items-center gap-2 rounded-xl px-3 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {leaving ? (
              <XIcon className="size-4 shrink-0" />
            ) : (
              <HomeIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{open.name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Close project</TooltipContent>
      </Tooltip>
    </div>
  )
}
