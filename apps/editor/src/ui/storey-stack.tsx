import { levelsOf } from '@houseit/core/levels'
import { PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  addStorey,
  moveStorey,
  removeStorey,
  renameStorey,
  setStoreyHeight,
} from '../edit/level-commands'
import { documentStore, useDocument } from '../store/store'
import { GAP, useRightEdge } from './edges'
import { useCover } from './use-cover'

/**
 * The storeys of the house, at the foot of the plan's right edge.
 *
 * One tab to a storey, stacked the way they stand — the top floor at the top —
 * with the one being drawn picked out. The same tabs as the plan and the walk,
 * turned on their side, because they are the same kind of thing: two ways of
 * looking at one house, and you are always in exactly one of them. So which
 * floor you are on is not something to read but something to see, and stepping
 * between them is one click on the floor you want.
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

  return (
    <div
      ref={ref}
      style={{ right: edge, bottom: GAP }}
      className="glass pointer-events-auto absolute z-30 flex flex-col items-center gap-1 rounded-2xl border p-1.5 transition-[right] duration-200 ease-linear"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Add a storey on top"
            className="size-9 rounded-full text-muted-foreground"
            onClick={() => addStorey(nameFor(storeys.length))}
          >
            <PlusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Add a storey on top</TooltipContent>
      </Tooltip>

      <Tabs
        orientation="vertical"
        value={level}
        onValueChange={(id) => documentStore.getState().setLevel(id)}
      >
        {/* The same pill the plan and the walk sit in, stood on its end. */}
        <TabsList className="w-full">
          {shown.map((storey) => {
            const dragging = carried?.id === storey.id
            return (
              <div key={storey.id} className="group/storey relative">
                <TabsTrigger
                  ref={(element) => {
                    if (element) buttons.current.set(storey.id, element)
                    else buttons.current.delete(storey.id)
                  }}
                  value={storey.id}
                  aria-label={`${storey.name}, storey ${storeys.indexOf(storey) + 1}`}
                  className={cn('size-9 justify-center! tabular-nums', dragging && 'opacity-50')}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId)
                    setCarried({ id: storey.id, from: event.clientY, moved: false })
                  }}
                  onPointerMove={(event) => {
                    if (carried?.id !== storey.id) return
                    // A press that has not travelled is still a click, not a drag.
                    if (!carried.moved && Math.abs(event.clientY - carried.from) < 4) return
                    setCarried({ ...carried, moved: true })
                  }}
                  onPointerUp={(event) => {
                    const drag = carried
                    setCarried(null)
                    if (drag?.id !== storey.id || !drag.moved) return
                    const to = placeUnder(event.clientY)
                    if (to !== undefined) moveStorey(storey.id, to)
                  }}
                >
                  {storeys.indexOf(storey) + 1}
                </TabsTrigger>

                {/* Beside the tab, not over the plan: what else this storey can be. */}
                <div className="pointer-events-none absolute top-0 right-full mr-2 hidden group-hover/storey:block group-focus-within/storey:block">
                  <div className="glass pointer-events-auto flex h-9 items-center gap-1 rounded-xl border pl-3">
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
                        <span className="max-w-40 truncate text-sm whitespace-nowrap">
                          {storey.name}
                        </span>
                        {/* Floor to floor, which is what a flight of stairs out
                            of here has to climb — so it is worth having to hand. */}
                        <Input
                          key={storey.height}
                          type="number"
                          defaultValue={storey.height}
                          aria-label={`Floor to floor of ${storey.name}, in millimetres`}
                          className="h-7 w-20 tabular-nums"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                          }}
                          onBlur={(event) => {
                            const height = Number(event.target.value)
                            if (Number.isFinite(height) && height > 0 && height !== storey.height) {
                              setStoreyHeight(storey.id, Math.round(height))
                            }
                          }}
                        />
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
        </TabsList>
      </Tabs>
    </div>
  )
}

/** A storey being dragged up or down the stack, and whether it has travelled at all. */
type Carried = { id: string; from: number; moved: boolean }

/** What the next storey up is called until somebody says otherwise. */
const nameFor = (built: number) => (built === 1 ? 'First floor' : `Floor ${built}`)
