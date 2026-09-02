import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useEditKeys } from './edit/use-edit-keys'
import { PlanScene } from './scene/plan-scene'
import { BottomBar } from './ui/bottom-bar'
import { Inspector } from './ui/inspector'
import { TopOverlay } from './ui/top-overlay'

/**
 * The shell: the plan as the main card, the inspector as a card beside it,
 * white on a quiet grey. What there is to press floats over the plan's
 * corners and along its foot; nothing sits above it.
 */
export function App() {
  useEditKeys()

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen className="h-dvh min-h-0 bg-muted p-3">
        <SidebarInset className="relative min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm md:peer-data-[variant=inset]:m-0">
          <PlanScene />
          <TopOverlay />
          <BottomBar />
        </SidebarInset>
        <Inspector />
      </SidebarProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
