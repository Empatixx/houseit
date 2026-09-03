import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useEditKeys } from './edit/use-edit-keys'
import { PlanScene } from './scene/plan-scene'
import { BottomBar } from './ui/bottom-bar'
import { Inspector } from './ui/inspector'
import { TopOverlay } from './ui/top-overlay'

/**
 * The shell: the plan as one card, white on a quiet grey, and everything else
 * floating over it — the cards at its top right corner, the bar along its
 * foot, the inspector down its right side. Nothing sits beside the plan, so
 * nothing that opens or folds away can move it.
 */
export function App() {
  useEditKeys()

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen className="h-dvh min-h-0 bg-muted p-3">
        <SidebarInset className="relative min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm">
          <PlanScene />
          <TopOverlay />
          <BottomBar />
          <Inspector />
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
