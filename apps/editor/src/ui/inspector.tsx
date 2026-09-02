import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import { PanelContent } from './panel'

/**
 * The panel beside the plan: what is picked, and what can be said about it.
 * A floating card on the right, which the header's button folds away.
 */
export function Inspector() {
  return (
    <Sidebar side="right" variant="floating" collapsible="offcanvas">
      <SidebarHeader className="px-4 pt-4 pb-1">
        <span className="text-sm font-semibold tracking-tight">Inspector</span>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-3 px-4 pb-4 text-sm">
        <PanelContent />
      </SidebarContent>
    </Sidebar>
  )
}
