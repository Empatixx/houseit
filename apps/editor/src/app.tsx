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
import { ModeTabs } from './ui/mode-tabs'
import { ProjectChip } from './ui/project-chip'
import { Rail } from './ui/rail'
import { RailPanel } from './ui/rail-panel'
import { StoreyStack } from './ui/storey-stack'
import { TopOverlay } from './ui/top-overlay'
import { WalkHint } from './ui/walk-hint'

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
          <ModeTabs />
          {mode === '2d' ? <BottomBar /> : <WalkHint />}
          <Inspector />
          <Rail />
          <RailPanel />
          <ProjectChip />
          <StoreyStack />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
