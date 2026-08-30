import { useState } from 'react'
import { PlanScene } from './scene/plan-scene'
import type { ViewMode } from './scene/view-mode'
import { Toolbar } from './ui/toolbar'

export function App() {
  const [view, setView] = useState<ViewMode>('plan')
  const [fitKey, setFitKey] = useState(0)

  return (
    <div className="flex h-full w-full flex-col bg-neutral-100 text-neutral-900">
      <Toolbar view={view} onView={setView} onFit={() => setFitKey((key) => key + 1)} />
      <main className="relative flex-1">
        <PlanScene view={view} fitKey={fitKey} />
      </main>
    </div>
  )
}
