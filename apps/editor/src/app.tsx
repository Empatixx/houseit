import { useState } from 'react'
import { PlanScene } from './scene/plan-scene'
import { Toolbar } from './ui/toolbar'

export function App() {
  const [fitKey, setFitKey] = useState(0)

  return (
    <div className="flex h-full w-full flex-col bg-neutral-100 text-neutral-900">
      <Toolbar onFit={() => setFitKey((key) => key + 1)} />
      <main className="relative flex-1">
        <PlanScene fitKey={fitKey} />
      </main>
    </div>
  )
}
