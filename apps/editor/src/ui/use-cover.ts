import { useEffect, useId, useRef } from 'react'
import { type Cover, type Edge, viewStore } from '../store/view'

export function useCover<T extends HTMLElement>(edge: Edge, active = true) {
  const id = useId()
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    const parent = element?.offsetParent as HTMLElement | null
    if (!element || !parent || !active) {
      viewStore.getState().cover(id, null)
      return
    }
    const report = () => viewStore.getState().cover(id, coverOf(element, edge))
    report()
    const watcher = new ResizeObserver(report)
    watcher.observe(element)
    watcher.observe(parent)
    return () => {
      watcher.disconnect()
      viewStore.getState().cover(id, null)
    }
  }, [edge, active, id])

  return ref
}

export function coverOf(element: HTMLElement, edge: Edge): Cover | null {
  if (element.offsetWidth === 0 || element.offsetHeight === 0) return null
  return { edge, extent: reachOf(element, edge) }
}

function reachOf(element: HTMLElement, edge: Edge): number {
  const parent = element.offsetParent as HTMLElement
  switch (edge) {
    case 'top':
      return element.offsetTop + element.offsetHeight
    case 'bottom':
      return parent.clientHeight - element.offsetTop
    case 'left':
      return element.offsetLeft + element.offsetWidth
    case 'right':
      return parent.clientWidth - element.offsetLeft
  }
}
