import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import type { GeometryClient } from './geometry-client'
import { acquireGeometry } from './geometry-session'

const EngineContext = createContext<GeometryClient | null>(null)

export function EngineProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<GeometryClient | null>(null)
  useEffect(() => {
    const { engine, release } = acquireGeometry()
    setEngine(engine)
    const hook = (window as unknown as { __houseit?: Record<string, unknown> }).__houseit
    if (import.meta.env.DEV && hook) hook.engine = engine
    return () => {
      release()
      if (hook?.engine === engine) delete hook.engine
    }
  }, [])
  return engine ? <EngineContext value={engine}>{children}</EngineContext> : null
}

export function useGeometryEngine() {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('The scene needs an EngineProvider')
  return engine
}
