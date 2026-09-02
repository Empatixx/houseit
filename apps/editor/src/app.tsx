import { useEditKeys } from './edit/use-edit-keys'
import { PlanScene } from './scene/plan-scene'
import { viewStore } from './store/view'
import { Palette } from './ui/palette'
import { Panel } from './ui/panel'
import { Toolbar } from './ui/toolbar'

export function App() {
  useEditKeys()

  return (
    <div className="flex h-full w-full flex-col bg-neutral-100 text-neutral-900">
      <Toolbar onFit={() => viewStore.getState().frame(null)} />
      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="relative min-w-0 flex-1">
          <PlanScene />
        </main>
        <Panel />
      </div>
    </div>
  )
}
