import { type PointerEvent as ReactPointerEvent, useRef } from 'react'
import { cn } from '@/lib/utils'
import { shellStore } from '../store/shell'
import { GAP, PANEL_WIDTH, usePanelShown } from './edges'
import { PanelContent } from './panel'
import { useCover } from './use-cover'

/** How far the panel has to be dragged towards the edge before it goes. */
const LET_GO = 90

/**
 * The panel over the plan: what is picked, and what can be said about it.
 * A card floating down the right edge, over the plan rather than beside it,
 * so folding it away moves nothing underneath — the plan stays put and Fit
 * knows what it is hidden behind. It is out while there is something to
 * show; the gear's button folds it away, and so does a drag on its edge
 * towards the side, until the next click on the plan brings it back.
 */
export function Inspector() {
  const open = usePanelShown()
  const ref = useCover<HTMLElement>('right', open)
  // Slid away, its left edge is at the plan's right edge: nothing of it shows.
  const away = PANEL_WIDTH + GAP

  return (
    <aside
      ref={ref}
      inert={!open}
      aria-hidden={!open}
      style={{
        width: PANEL_WIDTH,
        top: GAP,
        bottom: GAP,
        right: GAP,
        transform: open ? undefined : `translateX(${away}px)`,
      }}
      className={cn(
        'glass absolute z-20 flex flex-col overflow-hidden rounded-xl border transition-transform duration-200 ease-linear',
      )}
    >
      <DragEdge away={away} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pt-4 pb-4 text-sm">
        <PanelContent />
      </div>
    </aside>
  )
}

/**
 * The panel's left edge, to take hold of. Dragged towards the side, the whole
 * panel follows the pointer; let go far enough over, it folds away from where
 * it was let go. Let go short of that, it slides back.
 */
function DragEdge({ away }: { away: number }) {
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
        const gone = shift >= LET_GO
        if (box) {
          box.style.transition = ''
          box.style.transform = gone ? `translateX(${away}px)` : ''
        }
        if (gone) shellStore.getState().showPanel(false)
      }}
    />
  )
}
