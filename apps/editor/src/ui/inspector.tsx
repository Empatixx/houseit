import { type PointerEvent as ReactPointerEvent, useRef } from 'react'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { PanelContent } from './panel'
import { useCover } from './use-cover'

/** How wide the panel is; the cards at the top step aside by this much. */
export const INSPECTOR_WIDTH = '16rem'

/** How far the panel has to be dragged towards the edge before it goes. */
const LET_GO = 90

/**
 * The panel over the plan: what is picked, and what can be said about it.
 * A card floating down the right edge, over the plan rather than beside it,
 * so folding it away moves nothing underneath — the plan stays put and Fit
 * knows what it is hidden behind. The gear's button folds it away, and so
 * does a drag on its edge towards the side.
 */
export function Inspector() {
  const { open } = useSidebar()
  const ref = useCover<HTMLElement>('right', open)

  return (
    <aside
      ref={ref}
      inert={!open}
      aria-hidden={!open}
      style={{ width: INSPECTOR_WIDTH }}
      className={cn(
        'absolute inset-y-3 right-3 z-20 flex flex-col overflow-hidden rounded-xl border bg-card shadow-md transition-transform duration-200 ease-linear',
        open ? '' : 'translate-x-[calc(100%+0.75rem)]',
      )}
    >
      <DragEdge />
      <header className="flex items-center gap-2 px-4 pt-4 pb-1">
        <Logo size={18} />
        <span className="text-sm font-semibold tracking-tight">houseit</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pb-4 text-sm">
        <PanelContent />
      </div>
    </aside>
  )
}

/**
 * The panel's left edge, to take hold of. Dragged towards the side, the whole
 * panel follows the pointer; let go far enough over, it folds away. Let go
 * short of that, it slides back.
 */
function DragEdge() {
  const { setOpen } = useSidebar()
  const start = useRef<number | null>(null)

  const panel = (event: ReactPointerEvent) => event.currentTarget.parentElement

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to hide the panel"
      className="absolute inset-y-4 left-0 z-20 w-3 cursor-col-resize rounded-full transition-colors hover:bg-foreground/10 active:bg-foreground/15"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        start.current = event.clientX
        const box = panel(event)
        if (box) box.style.transition = 'none'
      }}
      onPointerMove={(event) => {
        if (start.current === null) return
        const shift = Math.max(0, event.clientX - start.current)
        const box = panel(event)
        if (box) box.style.transform = `translateX(${shift}px)`
      }}
      onPointerUp={(event) => {
        if (start.current === null) return
        const shift = Math.max(0, event.clientX - start.current)
        start.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        const box = panel(event)
        if (box) {
          box.style.transform = ''
          box.style.transition = ''
        }
        if (shift >= LET_GO) setOpen(false)
      }}
    />
  )
}
