import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector2 } from 'three'
import { useEngineView } from '../store/engine-view'
import { useDocument } from '../store/store'
import { useFragmentDisplay } from './fragment-display-layer'
import { NativeTools } from './native-tools'
import { useGeometryEngine } from './provider'

export function NativeToolsLayer({ sections = true }: { sections?: boolean }) {
  const engine = useGeometryEngine()
  const display = useFragmentDisplay()
  const get = useThree((state) => state.get)
  const tools = useRef<NativeTools | null>(null)
  const size = useThree((state) => state.size)
  const doc = useDocument((state) => state.doc)
  const view = useEngineView((state) => state.view)
  useEffect(() => {
    const instance = new NativeTools(
      display.components,
      display,
      get,
      () => engine.status.pending === 0 && !display.busy,
      sections,
    )
    tools.current = instance
    const hook = (window as unknown as { __houseit?: Record<string, unknown> }).__houseit
    if (import.meta.env.DEV && hook) hook.native = instance
    return () => {
      tools.current = null
      if (hook?.native === instance) delete hook.native
      display.toolsDisposal = instance.dispose()
    }
  }, [get, engine, sections, display])
  useEffect(() => {
    tools.current?.request()
  }, [doc, view])
  useEffect(() => {
    tools.current?.world.renderer?.resize(new Vector2(size.width, size.height))
  }, [size])
  useFrame(() => tools.current?.frame())
  return null
}
