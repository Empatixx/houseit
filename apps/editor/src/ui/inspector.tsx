import { type PointerEvent as ReactPointerEvent, useRef } from 'react'
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@/components/ui/sidebar'
import { Logo } from './logo'
import { PanelContent } from './panel'

/** How far the panel has to be dragged towards the edge before it goes. */
const LET_GO = 90

/**
 * The panel beside the plan: what is picked, and what can be said about it.
 * A floating card on the right, which the header's button folds away — and
 * which can be pushed away by hand, dragged by its edge off the side.
 */
export function Inspector() {
  return (
    <Sidebar side="right" variant="floating" collapsible="offcanvas">
      <DragEdge />
      <SidebarHeader className="flex-row items-center gap-2 px-4 pt-4 pb-1">
        <Logo size={18} />
        <span className="text-sm font-semibold tracking-tight">houseit</span>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-3 px-4 pb-4 text-sm">
        <PanelContent />
      </SidebarContent>
    </Sidebar>
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

  const container = (event: ReactPointerEvent) =>
    (event.currentTarget as HTMLElement).closest(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement | null

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
        const box = container(event)
        if (box) box.style.transition = 'none'
      }}
      onPointerMove={(event) => {
        if (start.current === null) return
        const shift = Math.max(0, event.clientX - start.current)
        const box = container(event)
        if (box) box.style.transform = `translateX(${shift}px)`
      }}
      onPointerUp={(event) => {
        if (start.current === null) return
        const shift = Math.max(0, event.clientX - start.current)
        start.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        const box = container(event)
        if (box) {
          box.style.transform = ''
          box.style.transition = ''
        }
        if (shift >= LET_GO) setOpen(false)
      }}
    />
  )
}
