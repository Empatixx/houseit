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

  /** Which storey the pointer is over, as a place in the stack counting from the lowest. */
  const placeUnder = (y: number): number | undefined => {
    for (const [id, element] of buttons.current) {
      const box = element.getBoundingClientRect()
      if (y >= box.top && y <= box.bottom) {
        return storeys.findIndex((storey) => storey.id === id) + 1
      }
    }
    return undefined
  }

  /** The storey the carried one would drop onto, which is the one it swaps with. */
  const over =
    carried?.moved === true
      ? storeys[(placeUnder(carried.from + carried.by) ?? 0) - 1]?.id
      : undefined

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
                // Lifted off the pile and out from under the others while it is
                // carried; the one it would drop onto says so with a dashed edge.
                dragging && carried.moved && 'scale-105 cursor-grabbing shadow-lg transition-none',
                over === storey.id && !dragging && 'border-dashed border-primary/60',
                // Only the resting cards animate, or the carried one lags the pointer.
                !dragging && 'transition-all',
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
                const to = placeUnder(event.clientY)
                if (to !== undefined) moveStorey(storey.id, to)
              }}
              // Carried, it goes with the pointer: a card being dragged that
              // stays where it was is a card that does not look dragged.
              style={
                dragging && carried.moved ? { transform: `translateY(${carried.by}px)` } : undefined
              }
            >
              {/* Says the card can be carried, without a handle to aim at:
                  the whole card is the handle. */}
              <GripHorizontalIcon className="size-3 opacity-40" />
              {storeys.indexOf(storey) + 1}
            </button>

            {/* Beside the card, not over the plan: what else this storey can be. */}
            <div
              className={cn(
                'pointer-events-none absolute top-1 right-full mr-2',
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
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * A storey being carried: where the press started, how far it has come, and
 * whether that is far enough to be a drag rather than a click.
 */
type Carried = { id: string; from: number; by: number; moved: boolean }

/** What the next storey up is called until somebody says otherwise. */
const nameFor = (built: number) => (built === 1 ? 'First floor' : `Floor ${built}`)
