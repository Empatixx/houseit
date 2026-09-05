import { levelsOf } from '@houseit/core/levels'
import { GripHorizontalIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { addStorey, moveStorey, removeStorey, renameStorey } from '../edit/level-commands'
import { documentStore, useDocument } from '../store/store'
import { GAP, useRightEdge } from './edges'
import { useCover } from './use-cover'

/**
 * The storeys of the house, at the foot of the plan's right edge.
 *
 * One card to a storey, stacked the way they stand — the top floor at the top —
 * with the one being drawn picked out. Cards rather than the parts of one
 * control, because that is what they are: separate things, each of which can be
 * picked up and put down somewhere else in the pile. A segmented control says
 * the opposite, that these are settings of one thing and fixed in their order.
 *
 * So which floor you are on is not something to read but something to see, and
 * stepping between them is one click on the floor you want.
 *
 * Hovering a card says which storey it is. Renaming it and taking it out are
 * offered only on the storey you are standing on, because a bin under every
 * card the pointer passes over is a bin waiting for a slip.
 *
 * The plus at its head builds another on top — at the head because that is
 * where the storey it makes will be. There is only the one, because
 * a house grows upwards: a cellar is `add-level --below` and rare enough not
 * to want a button of its own next to the one that is used every time.
 *
 * Dragging a storey up or down the stack moves it in the house, and everything
 * standing on it comes along — the rooms belong to the storey, not to the
 * height. Hovering one opens what else can be done to it beside the button,
 * where it does not stand between you and the plan.
 */
export function StoreyStack() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const edge = useRightEdge()
  const ref = useCover<HTMLDivElement>('right')
  const [naming, setNaming] = useState<string | null>(null)
  const [carried, setCarried] = useState<Carried | null>(null)
  const buttons = useRef(new Map<string, HTMLElement>())

  const storeys = levelsOf(doc)
  // Top floor at the top, the way a house is drawn in section.
  const shown = [...storeys].reverse()

  /**
   * Which card the pointer is over, as a place in the pile as it is drawn.
   *
   * Never the carried card itself, which is under the pointer by definition and
   * would otherwise be the only answer — the pile would then never make room
   * for it, and dropping it would put it back exactly where it came from.
   * Beyond either end of the pile, the end it went past.
   */
  const slotUnder = (y: number, carrying?: string): number | undefined => {
    const boxes = shown.flatMap((storey, slot) => {
      if (storey.id === carrying) return []
      const box = buttons.current.get(storey.id)?.getBoundingClientRect()
      return box ? [{ slot, box }] : []
    })
    const over = boxes.find(({ box }) => y >= box.top && y <= box.bottom)
    if (over) return over.slot
    const first = boxes[0]
    const last = boxes.at(-1)
    if (first && y < first.box.top) return first.slot
    if (last && y > last.box.bottom) return last.slot
    return undefined
  }

  /**
   * How far apart the cards sit, measured rather than assumed — and measured
   * off the layout rather than off the screen. A card being carried has been
   * moved by a transform, which `getBoundingClientRect` counts and `offsetTop`
   * does not; asking the screen mid-drag says the cards are a pixel apart.
   */
  const step = (): number => {
    const tops = shown
      .map((storey) => buttons.current.get(storey.id)?.offsetTop)
      .filter((top) => top !== undefined)
    const [first, second] = tops
    const apart = first !== undefined && second !== undefined ? Math.abs(second - first) : 0
    return apart > 8 ? apart : 50
  }

  // Where the carried card would land, and the pile as it would then read. The
  // cards keep their order in the DOM and are only shifted, so React never
  // remounts one mid-drag and the shift can be animated.
  const carrying = carried?.moved === true ? carried : undefined
  const landing = carrying ? slotUnder(carrying.from + carrying.by, carrying.id) : undefined
  const after = carrying && landing !== undefined ? resettle(shown, carrying.id, landing) : shown

  /**
   * Which storey a card would be, counting up from the ground — of the pile as
   * it would be, so a card carried to the bottom reads 1 before it is dropped
   * rather than after. `after` is drawn top first, so the count runs back.
   */
  const numberOf = (id: string): number =>
    after.length - after.findIndex((storey) => storey.id === id)

  /** How far a card has to move to show the pile as it would be. */
  const shift = (id: string): number => {
    if (!carrying || carrying.id === id) return 0
    const from = shown.findIndex((storey) => storey.id === id)
    const to = after.findIndex((storey) => storey.id === id)
    return (to - from) * step()
  }

  return (
    <div
      ref={ref}
      style={{ right: edge, bottom: GAP }}
      className="pointer-events-auto absolute z-30 flex flex-col items-center gap-1.5 transition-[right] duration-200 ease-linear"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Add a storey on top"
            className="glass h-9 w-14 rounded-xl border text-muted-foreground shadow-sm"
            onClick={() => addStorey(nameFor(storeys.length))}
          >
            <PlusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Add a storey on top</TooltipContent>
      </Tooltip>

      {shown.map((storey) => {
        const here = storey.id === level
        const dragging = carried?.id === storey.id
        return (
          <div
            key={storey.id}
            // The carried card has to outrank its neighbours, and a z-index
            // only counts between positioned elements — so it goes here, on the
            // wrapper the cards are siblings as, not on the card itself.
            style={dragging && carried.moved ? { zIndex: 20 } : undefined}
            className="group/storey relative"
          >
            <button
              type="button"
              ref={(element) => {
                if (element) buttons.current.set(storey.id, element)
                else buttons.current.delete(storey.id)
              }}
              aria-label={`${storey.name}, storey ${storeys.indexOf(storey) + 1}`}
              aria-current={here}
              className={cn(
                'glass flex h-11 w-14 cursor-grab flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-medium tabular-nums shadow-sm',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                here
                  ? 'border-primary text-foreground ring-1 ring-primary'
                  : 'text-muted-foreground hover:text-foreground hover:shadow-md',
                // Lifted off the pile while it is carried. The rest move aside
                // to show the order it would leave behind, and they animate;
                // the carried one does not, or it lags the pointer.
                dragging && carried.moved
                  ? 'scale-105 cursor-grabbing shadow-lg transition-none'
                  : 'transition-all',
              )}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                setCarried({ id: storey.id, from: event.clientY, by: 0, moved: false })
              }}
              onPointerMove={(event) => {
                if (carried?.id !== storey.id) return
                const by = event.clientY - carried.from
                // A press that has not travelled is still a click, not a drag.
                if (!carried.moved && Math.abs(by) < 4) return
                setCarried({ ...carried, moved: true, by })
              }}
              onPointerUp={(event) => {
                const drag = carried
                setCarried(null)
                if (drag?.id !== storey.id) return
                if (!drag.moved) {
                  documentStore.getState().setLevel(storey.id)
                  return
                }
                // The pile is drawn top floor first, so a place in it counts
                // back from the top to a storey counting up from the ground.
                const slot = slotUnder(event.clientY, storey.id)
                if (slot !== undefined) moveStorey(storey.id, shown.length - slot)
              }}
              // Carried, it goes with the pointer: a card being dragged that
              // stays where it was is a card that does not look dragged.
              style={{
                transform:
                  dragging && carried.moved
                    ? `translateY(${carried.by}px)`
                    : `translateY(${shift(storey.id)}px)`,
              }}
            >
              {/* Says the card can be carried, without a handle to aim at:
                  the whole card is the handle. */}
              <GripHorizontalIcon className="size-3 opacity-40" />
              {numberOf(storey.id)}
            </button>

            {/* Beside the card, not over the plan: what else this storey can be. */}
            <div
              className={cn(
                // Padded, not margined: a gap between the card and the panel is
                // a gap the pointer crosses, and crossing it lost the hover
                // before you ever reached the pencil.
                'pointer-events-none absolute top-1 right-full pr-2',
                'translate-x-3 opacity-0 transition-all duration-150 ease-out',
                'group-hover/storey:pointer-events-auto group-hover/storey:translate-x-0 group-hover/storey:opacity-100',
                'group-focus-within/storey:pointer-events-auto group-focus-within/storey:translate-x-0 group-focus-within/storey:opacity-100',
                // Nothing slides out from under a card being carried.
                carried?.moved === true && 'hidden',
              )}
            >
              <div className="glass flex h-9 items-center gap-1 rounded-xl border pl-3 shadow-sm">
                {naming === storey.id ? (
                  <Input
                    autoFocus
                    defaultValue={storey.name}
                    className="h-7 w-40"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        renameStorey(storey.id, event.currentTarget.value)
                        setNaming(null)
                      }
                      if (event.key === 'Escape') setNaming(null)
                    }}
                    onBlur={(event) => {
                      renameStorey(storey.id, event.target.value)
                      setNaming(null)
                    }}
                  />
                ) : (
                  <>
                    <span className="max-w-48 truncate text-sm whitespace-nowrap">
                      {storey.name}
                    </span>
                    {here ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Rename ${storey.name}`}
                          onClick={() => setNaming(storey.id)}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          aria-label={`Take out ${storey.name}`}
                          disabled={storeys.length < 2}
                          onClick={() => removeStorey(storey.id)}
                        >
                          <TrashIcon />
                        </Button>
                      </>
                    ) : (
                      <span className="w-3" />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** The pile as it would read with one card taken out and put back at `to`. */
function resettle<T extends { id: string }>(pile: T[], carried: string, to: number): T[] {
  const from = pile.findIndex((entry) => entry.id === carried)
  if (from === -1) return pile
  const rest = [...pile]
  const [taken] = rest.splice(from, 1)
  rest.splice(to, 0, taken!)
  return rest
}

/**
 * A storey being carried: where the press started, how far it has come, and
 * whether that is far enough to be a drag rather than a click.
 */
type Carried = { id: string; from: number; by: number; moved: boolean }

/** What the next storey up is called until somebody says otherwise. */
const nameFor = (built: number) => (built === 1 ? 'First floor' : `Floor ${built}`)
