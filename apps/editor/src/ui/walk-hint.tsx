/** Along the foot of the walk, what the hands do: the keys that walk and the drag that looks. */
export function WalkHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border bg-card px-3 py-2 text-xs text-muted-foreground shadow-md">
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
