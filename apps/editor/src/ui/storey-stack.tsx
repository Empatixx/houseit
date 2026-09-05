import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Level } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { GripHorizontalIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
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
 * picked up and put down somewhere else in the pile. So which floor you are on
 * is not something to read but something to see, and stepping between them is
 * one click on the floor you want.
 *
 * The carrying is dnd-kit's. A drag that reorders a list is not two pointer
 * handlers and a subtraction: it is capture, an activation distance, a measured
 * layout that has to be measured again after every change, keyboard
 * equivalents, and cancellation. Written by hand it worked once and then,
 * having measured the pile before the first drop and never again, would not
 * move anything a second time.
 *
 * Hovering a card says which storey it is. Renaming it and taking it out are
 * offered only on the storey you are standing on, because a bin under every
 * card the pointer passes over is a bin waiting for a slip.
 */
export function StoreyStack() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const edge = useRightEdge()
  const ref = useCover<HTMLDivElement>('right')
  const [naming, setNaming] = useState<string | null>(null)

  const storeys = levelsOf(doc)
  // Top floor at the top, the way a house is drawn in section.
  const shown = [...storeys].reverse()

  const sensors = useSensors(
    // Far enough that a click on a card is still a click on a card.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const settle = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const to = shown.findIndex((storey) => storey.id === over.id)
    if (to === -1) return
    // The pile is drawn top floor first, so a place in it counts back from the
    // top to a storey counting up from the ground.
    moveStorey(String(active.id), shown.length - to)
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={settle}
      >
        <SortableContext
          items={shown.map((storey) => storey.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col items-center gap-1.5">
            {shown.map((storey) => (
              <Storey
                key={storey.id}
                storey={storey}
                number={storeys.indexOf(storey) + 1}
                here={storey.id === level}
                only={storeys.length < 2}
                naming={naming === storey.id}
                onName={setNaming}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

type StoreyProps = {
  storey: Level
  /** Which storey it is, counting up from the ground. */
  number: number
  here: boolean
  only: boolean
  naming: boolean
  onName: (id: string | null) => void
}

function Storey({ storey, number, here, only, naming, onName }: StoreyProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: storey.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Above the rest of the pile while it is carried.
        zIndex: isDragging ? 20 : undefined,
      }}
      className="group/storey relative"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${storey.name}, storey ${number}`}
        aria-current={here}
        className={cn(
          'glass flex h-11 w-14 cursor-grab touch-none flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-medium tabular-nums shadow-sm select-none',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          here
            ? 'border-primary text-foreground ring-1 ring-primary'
            : 'text-muted-foreground hover:text-foreground hover:shadow-md',
          isDragging && 'scale-105 cursor-grabbing shadow-lg',
        )}
        onClick={() => documentStore.getState().setLevel(storey.id)}
      >
        {/* Says the card can be carried, without a handle to aim at: the whole
            card is the handle. */}
        <GripHorizontalIcon className="size-3 opacity-40" />
        {number}
      </button>

      {/* Beside the card, not over the plan: what else this storey can be. */}
      <div
        className={cn(
          // Padded, not margined: a gap between the card and the panel is a gap
          // the pointer crosses, and crossing it lost the hover before you ever
          // reached the pencil.
          'pointer-events-none absolute top-1 right-full pr-2',
          'translate-x-3 opacity-0 transition-all duration-150 ease-out',
          'group-hover/storey:pointer-events-auto group-hover/storey:translate-x-0 group-hover/storey:opacity-100',
          'group-focus-within/storey:pointer-events-auto group-focus-within/storey:translate-x-0 group-focus-within/storey:opacity-100',
          // Nothing slides out from under a card being carried.
          isDragging && 'hidden',
        )}
      >
        <div className="glass flex h-9 items-center gap-1 rounded-xl border pl-3 shadow-sm">
          {naming ? (
            <Input
              autoFocus
              defaultValue={storey.name}
              className="h-7 w-40"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  renameStorey(storey.id, event.currentTarget.value)
                  onName(null)
                }
                if (event.key === 'Escape') onName(null)
              }}
              onBlur={(event) => {
                renameStorey(storey.id, event.target.value)
                onName(null)
              }}
            />
          ) : (
            <>
              <span className="max-w-48 truncate text-sm whitespace-nowrap">{storey.name}</span>
              {here ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Rename ${storey.name}`}
                    onClick={() => onName(storey.id)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    aria-label={`Take out ${storey.name}`}
                    disabled={only}
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
}

/** What the next storey up is called until somebody says otherwise. */
const nameFor = (built: number) => (built === 1 ? 'First floor' : `Floor ${built}`)
