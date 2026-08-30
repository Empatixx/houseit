import type { ViewMode } from '../scene/view-mode'
import { documentStore, useDocument } from '../store/store'
import { CommandBar } from './command-bar'

const button =
  'rounded border border-neutral-300 bg-white px-2.5 py-1 text-sm text-neutral-700 enabled:hover:border-neutral-400 disabled:opacity-40'

type ToolbarProps = {
  view: ViewMode
  onView: (view: ViewMode) => void
  onFit: () => void
}

export function Toolbar({ view, onView, onFit }: ToolbarProps) {
  const canUndo = useDocument((state) => state.canUndo)
  const canRedo = useDocument((state) => state.canRedo)

  return (
    <header className="flex items-start gap-4 border-b border-neutral-200 bg-white px-4 py-2">
      <span className="py-1 text-sm font-semibold tracking-tight text-neutral-900">houseit</span>

      <CommandBar />

      <div className="ml-auto flex gap-2">
        <button
          type="button"
          className={button}
          disabled={!canUndo}
          onClick={() => documentStore.getState().undo()}
        >
          Undo
        </button>
        <button
          type="button"
          className={button}
          disabled={!canRedo}
          onClick={() => documentStore.getState().redo()}
        >
          Redo
        </button>
        <button type="button" className={button} onClick={onFit}>
          Fit
        </button>
        <button
          type="button"
          className={button}
          onClick={() => onView(view === 'plan' ? 'perspective' : 'plan')}
        >
          {view === 'plan' ? '3D' : 'Plan'}
        </button>
      </div>
    </header>
  )
}
