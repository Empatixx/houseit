import { useEffect, useState } from 'react'
import { engineViewStore, type Hideable, useEngineView } from '../store/engine-view'
import { useWalk, walkStore } from '../store/walk'
import { useLeftEdge, useRightEdge } from './edges'

const SHOWN: [Hideable, string][] = [
  ['furniture', 'Furniture'],
  ['openings', 'Doors & windows'],
  ['roofs', 'Roofs'],
  ['ceilings', 'Ceilings'],
  ['site', 'Site'],
]

const KEYS_SHOWN = 4000
const FADE = 300

export function WalkHint() {
  const left = useLeftEdge()
  const right = useRightEdge()
  const free = useWalk((state) => state.movement === 'free')
  const inspection = useWalk((state) => state.inspection)
  const hidden = useEngineView((state) => state.hidden)
  const [keys, setKeys] = useState<'shown' | 'fading' | 'gone'>('shown')
  useEffect(() => {
    setKeys('shown')
    const fade = setTimeout(() => setKeys('fading'), KEYS_SHOWN)
    const gone = setTimeout(() => setKeys('gone'), KEYS_SHOWN + FADE)
    return () => {
      clearTimeout(fade)
      clearTimeout(gone)
    }
  }, [free])
  return (
    <div
      style={{ left, right }}
      className="pointer-events-none absolute bottom-4 flex justify-center transition-[left,right] duration-200 ease-linear"
    >
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2 text-xs text-muted-foreground">
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
        {keys !== 'gone' && (
          <span
            className="flex items-center gap-3 transition-opacity duration-300"
            style={{ opacity: keys === 'fading' ? 0 : 1 }}
          >
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
          </span>
        )}
        <span className="flex items-center gap-1 border-l pl-3">
          {SHOWN.map(([group, label]) => (
            <button
              key={group}
              type="button"
              aria-pressed={!hidden.includes(group)}
              className="rounded border px-2 py-1 text-foreground aria-[pressed=false]:text-muted-foreground aria-[pressed=false]:line-through"
              onClick={() =>
                engineViewStore.getState().configure({
                  hidden: hidden.includes(group)
                    ? hidden.filter((it) => it !== group)
                    : [...hidden, group],
                })
              }
            >
              {label}
            </button>
          ))}
        </span>
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
