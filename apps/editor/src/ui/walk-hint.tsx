import { useLeftEdge, useRightEdge } from './edges'

/** Along the foot of the walk, what the hands do: the keys that walk and the drag that looks. */
export function WalkHint() {
  const left = useLeftEdge()
  const right = useRightEdge()
  return (
    <div
      style={{ left, right }}
      className="pointer-events-none absolute bottom-4 flex justify-center transition-[left,right] duration-200 ease-linear"
    >
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2 text-xs text-muted-foreground">
        <span>
          <Key>W</Key>
          <Key>A</Key>
          <Key>S</Key>
          <Key>D</Key> walk
        </span>
        <span>
          <Key>⇧</Key> run
        </span>
        <span>
          <Key>←</Key>
          <Key>→</Key> turn
        </span>
        <span>drag to look · click to pick</span>
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
