import { Maximize2Icon, MinusIcon, PlusIcon, Redo2Icon, Undo2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ZOOM } from '../scene/zooming'
import { useMode } from '../store/mode'
import { useSelection } from '../store/selection'
import { documentStore, useDocument } from '../store/store'
import { viewStore } from '../store/view'
import { Compass } from './compass'
import { usePanelShown, useRightEdge } from './edges'
import { Minimap } from './minimap'
import { useCover } from './use-cover'

export function TopOverlay() {
  const canUndo = useDocument((state) => state.canUndo)
  const canRedo = useDocument((state) => state.canRedo)
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fit to plan"
                onClick={() => viewStore.getState().frame(null)}
              >
                <Maximize2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to plan</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger aria-label="Toggle the panel" disabled={!shown && !picked} />
            </TooltipTrigger>
            <TooltipContent>Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {walking ? null : <Compass />}
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
