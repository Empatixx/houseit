import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** A box on the plan, in millimetres. */
export type ViewBox = { x0: number; y0: number; x1: number; y1: number }

export type Edge = 'top' | 'right' | 'bottom' | 'left'

/**
 * Something floating over the plan: the edge of the canvas it hangs on, and
 * how far in from that edge it reaches, in CSS pixels. The panel down the
 * right side is one; the bar along the foot another.
 */
export type Cover = { edge: Edge; extent: number }

/** A part of the canvas, in CSS pixels from its top left corner. */
export type Clear = { x: number; y: number; width: number; height: number }

type ViewState = {
  /** What to frame: a box, or nothing for the whole plan. */
  box: ViewBox | null
  /** Counts the asks, so asking for the same framing twice frames it twice. */
  asked: number
  frame: (box: ViewBox | null) => void
  /** What floats over the plan just now, by whoever put it there. */
  covers: Record<string, Cover>
  cover: (id: string, cover: Cover | null) => void
}

/**
 * What the camera has been asked to look at. The Fit button asks for the plan;
 * the agent, wanting a picture of one room, asks for that room. Neither is
 * part of the document — where the camera is has nothing to do with the plan.
 *
 * It also knows what is in the way. The cards over the plan hide some of the
 * canvas, and a plan fitted to the whole canvas ends up partly behind the panel.
 * So each of them says how much it covers, and Fit frames the plan in what is
 * left. Covering is not framing: the panel folding away changes what is
 * covered and moves nothing — the plan stays where it was until Fit is asked.
 */
export const viewStore = createStore<ViewState>()((set) => ({
  box: null,
  asked: 0,
  frame: (box) => set((state) => ({ box, asked: state.asked + 1 })),
  covers: {},
  cover: (id, cover) =>
    set((state) => {
      const covers = { ...state.covers }
      if (cover) covers[id] = cover
      else delete covers[id]
      return { covers }
    }),
}))

export function useView<T>(selector: (state: ViewState) => T): T {
  return useStore(viewStore, selector)
}

/**
 * The part of a canvas nothing floats over: the canvas less the furthest reach
 * from each edge. Never empty — a canvas covered right across still frames
 * into a pixel rather than dividing by nothing.
 */
export function clearOf(
  covers: Record<string, Cover>,
  size: { width: number; height: number },
): Clear {
  const reach = (edge: Edge) =>
    Math.max(
      0,
      ...Object.values(covers)
        .filter((cover) => cover.edge === edge)
        .map((cover) => cover.extent),
    )
  const x = reach('left')
  const y = reach('top')
  return {
    x,
    y,
    width: Math.max(1, size.width - x - reach('right')),
    height: Math.max(1, size.height - y - reach('bottom')),
  }
}
