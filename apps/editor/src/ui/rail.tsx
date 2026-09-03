import {
  LayersIcon,
  LayoutListIcon,
  LibraryBigIcon,
  ListChecksIcon,
  type LucideIcon,
} from 'lucide-react'
import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { type RailTab, shellStore, useShell } from '../store/shell'
import { GAP, RAIL_OPEN_WIDTH, RAIL_WIDTH } from './edges'
import { Logo } from './logo'
import { useCover } from './use-cover'

/** The rail's tabs, top to bottom, each with its mark. Nothing is behind them yet. */
const TABS: { id: RailTab; label: string; icon: LucideIcon }[] = [
  { id: 'rooms', label: 'Rooms', icon: LayoutListIcon },
  { id: 'levels', label: 'Levels', icon: LayersIcon },
  { id: 'issues', label: 'Issues', icon: ListChecksIcon },
  { id: 'catalogue', label: 'Catalogue', icon: LibraryBigIcon },
]

/**
 * The rail down the plan's left edge: the mark at its head and a column of
 * tabs under it. Folded, it is the icons alone; pulled out, each has its
 * name beside it. It never goes away altogether. A drag on its edge pulls it
 * out or folds it, and it settles on whichever it is nearer when let go.
 */
export function Rail() {
  const open = useShell((state) => state.rail)
  const tab = useShell((state) => state.tab)
  const ref = useCover<HTMLElement>('left')
  const named = cn(
    'whitespace-nowrap transition-opacity duration-200 ease-linear',
    open ? 'opacity-100' : 'opacity-0',
  )

  return (
    <aside
      ref={ref}
      style={{ width: open ? RAIL_OPEN_WIDTH : RAIL_WIDTH, top: GAP, left: GAP, bottom: GAP }}
      className="glass absolute z-30 flex flex-col overflow-hidden rounded-xl border transition-[width] duration-200 ease-linear"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 pl-[13px]">
        <Logo size={22} />
        <span className={cn('text-sm font-semibold tracking-tight', named)}>
          house<span className="text-primary">it</span>
        </span>
      </div>
      <nav aria-label="Rail" className="flex flex-col gap-1 px-1.5">
        {TABS.map((entry) => (
          <Named key={entry.id} label={entry.label} shown={!open}>
            <Button
              variant={entry.id === tab ? 'secondary' : 'ghost'}
              aria-label={entry.label}
              aria-pressed={entry.id === tab}
              className="h-9 w-full justify-start gap-2 px-2.5"
              onClick={() => shellStore.getState().showTab(entry.id)}
            >
              <entry.icon className="shrink-0" />
              <span className={named}>{entry.label}</span>
            </Button>
          </Named>
        ))}
      </nav>
      <StretchEdge />
    </aside>
  )
}

/** A tab's name in a tip beside it, while the rail is folded and the name is not shown. */
function Named({ label, shown, children }: { label: string; shown: boolean; children: ReactNode }) {
  if (!shown) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The rail's right edge, to take hold of. Dragged, the rail is as wide as the
 * pointer makes it; let go, it settles on whichever it is nearer — pulled out
 * or folded to its icons.
 */
function StretchEdge() {
  const start = useRef<{ x: number; width: number } | null>(null)

  const rail = (event: ReactPointerEvent) => event.currentTarget.parentElement
  const widthAt = (event: ReactPointerEvent) => {
    const held = start.current
    if (!held) return RAIL_WIDTH
    const pulled = held.width + (event.clientX - held.x)
    return Math.min(RAIL_OPEN_WIDTH, Math.max(RAIL_WIDTH, pulled))
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to pull the rail out or fold it"
      className="absolute inset-y-4 right-0 z-20 w-2 cursor-col-resize rounded-full transition-colors hover:bg-foreground/10 active:bg-foreground/15"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const box = rail(event)
        if (!box) return
        event.currentTarget.setPointerCapture(event.pointerId)
        start.current = { x: event.clientX, width: box.offsetWidth }
        box.style.transition = 'none'
      }}
      onPointerMove={(event) => {
        if (start.current === null) return
        const box = rail(event)
        if (box) box.style.width = `${widthAt(event)}px`
      }}
      onPointerUp={(event) => {
        if (start.current === null) return
        const width = widthAt(event)
        start.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        const open = width > (RAIL_WIDTH + RAIL_OPEN_WIDTH) / 2
        const box = rail(event)
        if (box) {
          // Settles from where it was let go, rather than jumping back first.
          box.style.transition = ''
          box.style.width = `${open ? RAIL_OPEN_WIDTH : RAIL_WIDTH}px`
        }
        shellStore.getState().pullRail(open)
      }}
    />
  )
}
