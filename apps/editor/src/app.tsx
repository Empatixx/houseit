import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useEditKeys } from './edit/use-edit-keys'
import { PlanScene } from './scene/plan-scene'
import { WalkScene } from './scene/walk/walk-scene'
import { useMode } from './store/mode'
import { shellStore } from './store/shell'
import { BottomBar } from './ui/bottom-bar'
import { usePanelShown } from './ui/edges'
import { Inspector } from './ui/inspector'
import { ProjectChip } from './ui/project-chip'
import { Rail } from './ui/rail'
import { StoreyCard } from './ui/storey-card'
import { TopOverlay } from './ui/top-overlay'
import { WalkHint } from './ui/walk-hint'

/**
 * The shell: the plan as one card, white on warm paper, and everything else
 * floating over it in glass — the rail down its left edge with the mark at
 * its head, the project's name beside it, the cards at its top right, the bar
 * along its foot, the panel down its right edge. Nothing sits beside the plan, so nothing that opens
 * or folds away can move it. Walked through, the plan is the same card with
 * another camera in it, and the palette gives way to the keys that walk.
 */
export function App() {
  useEditKeys()
  const mode = useMode((state) => state.mode)
  const panel = usePanelShown()

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider
        open={panel}
        onOpenChange={(open) => shellStore.getState().showPanel(open)}
        className="h-dvh min-h-0 bg-muted p-3"
      >
        <SidebarInset className="relative min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm">
          {mode === '2d' ? <PlanScene /> : <WalkScene />}
          <TopOverlay />
          {mode === '2d' ? <BottomBar /> : <WalkHint />}
          <Inspector />
          <Rail />
          <ProjectChip />
          <StoreyCard />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
