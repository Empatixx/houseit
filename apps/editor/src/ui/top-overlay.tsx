import {
  Maximize2Icon,
  MinusIcon,
  PlusIcon,
  Redo2Icon,
  SettingsIcon,
  Undo2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ZOOM } from '../scene/zooming'
import { useMode } from '../store/mode'
import { selectionStore, useSelection } from '../store/selection'
import { documentStore, useDocument } from '../store/store'
import { viewStore } from '../store/view'
import { usePanelShown, useRightEdge } from './edges'
import { Minimap } from './minimap'
import { ModeTabs } from './mode-tabs'
import { useCover } from './use-cover'

export function TopOverlay() {
  const canUndo = useDocument((state) => state.canUndo)
  const canRedo = useDocument((state) => state.canRedo)
  const showAll = useSelection((state) => state.showAll)
  const walking = useMode((state) => state.mode === '3d')
  const edge = useRightEdge()
  const shown = usePanelShown()
  const picked = useSelection((state) => state.selected !== null)
  const ref = useCover<HTMLDivElement>('top')

  return (
    <div
      ref={ref}
      style={{ right: edge }}
      className="pointer-events-none absolute top-3 flex flex-col items-end gap-2 transition-[right] duration-200 ease-linear"
    >
      <div className="flex items-center gap-2">
        <div className="glass pointer-events-auto flex h-10 items-center gap-0.5 rounded-xl border px-1">
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
        <div className="glass pointer-events-auto flex h-10 items-center gap-0.5 rounded-xl border px-1">
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
              <SidebarTrigger aria-label="Toggle the panel" disabled={!shown && !picked} />
            </TooltipTrigger>
            <TooltipContent>Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <ModeTabs />
      {walking ? null : <Scale />}
      {walking ? <Minimap /> : null}
    </div>
  )
}

function Scale() {
  return (
    <div className="glass pointer-events-auto flex w-10 flex-col items-center gap-0.5 rounded-xl border py-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Closer"
            onClick={() => viewStore.getState().zoomBy(ZOOM.step)}
          >
            <PlusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Closer</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Further"
            onClick={() => viewStore.getState().zoomBy(1 / ZOOM.step)}
          >
            <MinusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Further</TooltipContent>
      </Tooltip>
    </div>
  )
}
