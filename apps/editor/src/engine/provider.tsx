import { type ReactNode, useEffect } from 'react'
import { acquireGeometry } from './geometry-session'

export function EngineProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const { engine, release } = acquireGeometry()
    const hook = (window as unknown as { __houseit?: Record<string, unknown> }).__houseit
    if (import.meta.env.DEV && hook) hook.engine = engine
    return () => {
      release()
      if (hook?.engine === engine) delete hook.engine
    }
  }, [])
  return children
}
