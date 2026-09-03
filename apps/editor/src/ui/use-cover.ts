import { useEffect, useId, useRef } from 'react'
import { type Edge, viewStore } from '../store/view'

/**
 * Tells the view how much of the plan the element this is put on hides, from
 * the edge of the canvas it hangs on: a panel down the right reaches in as far
 * as its left edge, a bar along the foot as far as its top. Fit reads it and
 * frames the plan in what is left.
 *
 * Measured without transforms, so a panel sliding away is still where it is
 * laid out; `active` says whether it counts at all.
 */
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
    const report = () => viewStore.getState().cover(id, { edge, extent: reachOf(element, edge) })
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

/** How far in from an edge of its parent an element reaches, in CSS pixels. */
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
