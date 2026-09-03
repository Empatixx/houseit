import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useEditKeys } from './edit/use-edit-keys'
import { PlanScene } from './scene/plan-scene'
import { WalkScene } from './scene/walk/walk-scene'
import { useMode } from './store/mode'
import { BottomBar } from './ui/bottom-bar'
import { Inspector } from './ui/inspector'
import { ModeTabs } from './ui/mode-tabs'
import { TopOverlay } from './ui/top-overlay'
import { WalkHint } from './ui/walk-hint'

/**
 * The shell: the plan as one card, white on a quiet grey, and everything else
 * floating over it — the tabs at its top left, the cards at its top right,
 * the bar along its foot, the inspector down its right side. Nothing sits
 * beside the plan, so nothing that opens or folds away can move it. Walked
 * through, the plan is the same card with another camera in it, and the
 * palette gives way to the keys that walk.
 */
export function App() {
  useEditKeys()
  const mode = useMode((state) => state.mode)

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen className="h-dvh min-h-0 bg-muted p-3">
        <SidebarInset className="relative min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm">
          {mode === '2d' ? <PlanScene /> : <WalkScene />}
          <ModeTabs />
          <TopOverlay />
          {mode === '2d' ? <BottomBar /> : <WalkHint />}
          <Inspector />
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
