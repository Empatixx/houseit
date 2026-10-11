import { CircleIcon, ClapperboardIcon, SquareIcon } from 'lucide-react'
import { tourOf } from '../scene/walk/shots'
import { documentStore } from '../store/store'
import { tourStore, useTour } from '../store/tour'
import { useWalk, walkStore } from '../store/walk'
import { useLeftEdge, useRightEdge } from './edges'

export function WalkHint() {
  const left = useLeftEdge()
  const right = useRightEdge()
  const free = useWalk((state) => state.movement === 'free')
  const inspection = useWalk((state) => state.inspection)
  const shot = useTour((state) => state.shots[state.index])
  const count = useTour((state) => state.shots.length)
  const index = useTour((state) => state.index)
  const recording = useTour((state) => state.recording)

  const tour = (record: boolean) => {
    const { doc, level } = documentStore.getState()
    const shots = tourOf(doc, walkStore.getState().fov, level)
    if (shots.length > 0) tourStore.getState().play(shots, record)
  }

  return (
    <div
      style={{ left, right }}
      className="pointer-events-none absolute bottom-4 flex justify-center transition-[left,right] duration-200 ease-linear"
    >
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2 text-xs text-muted-foreground">
        {shot ? (
          <>
            {recording && <CircleIcon className="size-3 fill-red-500 text-red-500" />}
            <span className="text-foreground">{shot.name}</span>
            <span>
              {index + 1} / {count}
            </span>
            <button
              type="button"
              className="flex items-center gap-1 rounded border px-2 py-1 text-foreground"
              onClick={() => tourStore.getState().stop()}
            >
              <SquareIcon className="size-3" />
              Stop
            </button>
          </>
        ) : (
          <>
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
            <button
              type="button"
              className="flex items-center gap-1 rounded border px-2 py-1 text-foreground"
              onClick={() => tour(false)}
            >
              <ClapperboardIcon className="size-3.5" />
              Tour
            </button>
            <button
              type="button"
              aria-label="Record the tour"
              title="Record the tour as a video"
              className="flex items-center gap-1 rounded border px-2 py-1 text-foreground"
              onClick={() => tour(true)}
            >
              <CircleIcon className="size-3 fill-red-500 text-red-500" />
              Record
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
          </>
        )}
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
