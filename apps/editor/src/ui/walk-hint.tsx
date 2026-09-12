import { buildingView } from '../scene/building-view'
import { documentStore } from '../store/store'
import { useWalk, walkStore } from '../store/walk'
import { useLeftEdge, useRightEdge } from './edges'

export function WalkHint() {
  const left = useLeftEdge()
  const right = useRightEdge()
  const free = useWalk((state) => state.movement === 'free')
  const inspection = useWalk((state) => state.inspection)
  return (
    <div
      style={{ left, right }}
      className="pointer-events-none absolute bottom-4 flex justify-center transition-[left,right] duration-200 ease-linear"
    >
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2 text-xs text-muted-foreground">
        <button
          type="button"
          className="rounded border px-2 py-1 text-foreground"
          onClick={() =>
            walkStore.getState().inspect(buildingView(documentStore.getState().doc, 'overview'))
          }
        >
          Whole building
        </button>
        <button
          type="button"
          aria-pressed={free}
          className="rounded border px-2 py-1 text-foreground"
          onClick={() => {
            if (inspection) walkStore.getState().explore()
            else walkStore.getState().setMovement(free ? 'walk' : 'free')
          }}
        >
          {inspection ? 'Explore' : free ? 'Free camera' : 'Walk with collisions'}
        </button>
        <span>
          <Key>W</Key>
          <Key>A</Key>
          <Key>S</Key>
          <Key>D</Key> {free ? 'move' : 'walk'}
        </span>
        {free && (
          <span>
            <Key>Q</Key> down <Key>E</Key> up
          </span>
        )}
        <span>
          <Key>⇧</Key> faster
        </span>
        <span>
          <Key>←</Key>
          <Key>→</Key> turn
        </span>
        <span>drag to look</span>
      </div>
    </div>
  )
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="mr-0.5 inline-block min-w-5 rounded border bg-muted px-1 text-center font-sans text-[10px] text-foreground">
      {children}
    </kbd>
  )
}
