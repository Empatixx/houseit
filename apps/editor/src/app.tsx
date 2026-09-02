import { PlanScene } from './scene/plan-scene'
import { viewStore } from './store/view'
import { Toolbar } from './ui/toolbar'

export function App() {
  return (
    <div className="flex h-full w-full flex-col bg-neutral-100 text-neutral-900">
      <Toolbar onFit={() => viewStore.getState().frame(null)} />
      <main className="relative flex-1">
        <PlanScene />
      </main>
    </div>
  )
}
