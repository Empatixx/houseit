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
import { startOf } from '../scene/walk/start'
import { modeStore } from '../store/mode'
import { documentStore, useDocument } from '../store/store'
import { walkStore } from '../store/walk'
import { GAP, useRightEdge } from './edges'
import { useCover } from './use-cover'

export function StoreyStack() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const edge = useRightEdge()
  const ref = useCover<HTMLDivElement>('right')
  const [naming, setNaming] = useState<string | null>(null)

  const storeys = levelsOf(doc)
  const shown = [...storeys].reverse()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const settle = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const to = shown.findIndex((storey) => storey.id === over.id)
    if (to === -1) return
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
          'glass flex h-16 w-24 cursor-grab touch-none flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-medium tabular-nums shadow-sm select-none',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          here
            ? 'border-primary text-foreground ring-1 ring-primary'
            : 'text-muted-foreground hover:text-foreground hover:shadow-md',
          isDragging && 'scale-105 cursor-grabbing shadow-lg',
        )}
        onClick={() => {
          documentStore.getState().setLevel(storey.id)
          if (modeStore.getState().mode === '3d') {
            const start = startOf(documentStore.getState().doc, storey.id)
            if (start) walkStore.getState().place(start.at, start.yaw)
          }
        }}
      >
        <GripHorizontalIcon className="size-3 opacity-40" />
        <span className="max-w-20 truncate">{storey.name}</span>
        <span className="text-[10px] font-normal">
          {storey.elevation > 0 ? '+' : ''}
          {(storey.elevation / 1000).toFixed(3)} m
        </span>
      </button>

      <div
        className={cn(
          'pointer-events-none absolute top-1 right-full pr-2',
          'translate-x-3 opacity-0 transition-all duration-150 ease-out',
          'group-hover/storey:pointer-events-auto group-hover/storey:translate-x-0 group-hover/storey:opacity-100',
          'group-focus-within/storey:pointer-events-auto group-focus-within/storey:translate-x-0 group-focus-within/storey:opacity-100',
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

const nameFor = (built: number) => (built === 1 ? 'First floor' : `Floor ${built}`)
