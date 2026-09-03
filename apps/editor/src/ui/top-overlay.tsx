import { Maximize2Icon, Redo2Icon, SettingsIcon, Undo2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMode } from '../store/mode'
import { selectionStore, useSelection } from '../store/selection'
import { documentStore, useDocument } from '../store/store'
import { viewStore } from '../store/view'
import { INSPECTOR_WIDTH } from './inspector'
import { Minimap } from './minimap'
import { useCover } from './use-cover'

/**
 * What floats over the plan's top right corner: one small card with the two
 * arrows that take an edit back and forward, and another with the gear for
 * what the plan shows and the button for the panel. The panel floats over
 * the same corner, so while it is out the cards stand to the left of it.
 * Walking through the plan, the minimap hangs under them.
 */
export function TopOverlay() {
  const canUndo = useDocument((state) => state.canUndo)
  const canRedo = useDocument((state) => state.canRedo)
  const showAll = useSelection((state) => state.showAll)
  const walking = useMode((state) => state.mode === '3d')
  const { open } = useSidebar()
  const ref = useCover<HTMLDivElement>('top')

  return (
    <div
      ref={ref}
      style={{ right: open ? `calc(${INSPECTOR_WIDTH} + 1.5rem)` : '0.75rem' }}
      className="pointer-events-none absolute top-3 flex flex-col items-end gap-2 transition-[right] duration-200 ease-linear"
    >
      <div className="flex items-center gap-2">
        <div className="pointer-events-auto flex h-10 items-center gap-0.5 rounded-xl border bg-card px-1 shadow-md">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canUndo}
                aria-label="Undo"
                onClick={() => documentStore.getState().undo()}
              >
                <Undo2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo ⌘Z</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canRedo}
                aria-label="Redo"
                onClick={() => documentStore.getState().redo()}
              >
                <Redo2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo ⇧⌘Z</TooltipContent>
          </Tooltip>
        </div>
        <div className="pointer-events-auto flex h-10 items-center gap-0.5 rounded-xl border bg-card px-1 shadow-md">
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="View settings">
                    <SettingsIcon />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-64">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="measurements" className="text-sm">
                    Measurements
                  </Label>
                  <Switch
                    id="measurements"
                    checked={showAll}
                    onCheckedChange={(on) => selectionStore.getState().showDimensions(on)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewStore.getState().frame(null)}
                  className="justify-start"
                >
                  <Maximize2Icon />
                  Fit to plan
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger aria-label="Toggle the panel" />
            </TooltipTrigger>
            <TooltipContent>Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {walking ? <Minimap /> : null}
    </div>
  )
}
