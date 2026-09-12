import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { engineViewStore } from '../store/engine-view'
import { modeStore } from '../store/mode'
import { documentStore } from '../store/store'
import { NativeWorld } from './native-world'

export function NativeScene() {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    const native = new NativeWorld(container.current, (state) => {
      engineViewStore.setState({ busy: state.busy, error: state.error, tool: state.tool })
      if (state.error) toast.error(state.error, { id: 'native-engine' })
    })
    const hook = (window as unknown as { __houseit?: Record<string, unknown> }).__houseit
    if (import.meta.env.DEV && hook) {
      hook.native = native
      hook.toScreen = (x: number, y: number, height = 0) => native.toScreen(x, y, height)
    }
    const show = () => {
      const state = engineViewStore.getState()
      void native.show(
        state.view,
        documentStore.getState().level,
        state.view === 'plan' ? state.cutHeight : state.sectionOffset,
      )
    }
    const stops = [
      documentStore.subscribe((state, previous) => {
        if (state.doc !== previous.doc) void native.update(state.doc)
        if (state.level !== previous.level) show()
      }),
      modeStore.subscribe((state) =>
        engineViewStore.getState().setView(state.mode === '2d' ? 'plan' : '3d'),
      ),
      engineViewStore.subscribe((state, previous) => {
        if (
          state.view !== previous.view ||
          state.cutHeight !== previous.cutHeight ||
          state.sectionOffset !== previous.sectionOffset
        )
          show()
        if (state.tool !== previous.tool) native.setTool(state.tool)
        if (state.snap !== previous.snap) native.setSnapping(state.snap)
        if (state.clearRequested !== previous.clearRequested) native.clearMeasurements()
      }),
    ]
    engineViewStore.getState().setView(modeStore.getState().mode === '2d' ? 'plan' : '3d')
    show()
    void native.update(documentStore.getState().doc)
    return () => {
      for (const stop of stops) stop()
      if (hook?.native === native) delete hook.native
      void native.dispose()
    }
  }, [])
  return (
    <div className="absolute inset-0">
      <div
        ref={container}
        className="h-full w-full overflow-hidden"
        data-testid="native-viewport"
      />
    </div>
  )
}
