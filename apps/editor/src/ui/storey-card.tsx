import { levelsOf } from '@houseit/core/levels'
import { ChevronDownIcon, LayersIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addStorey, removeStorey, renameStorey, setStoreyHeight } from '../edit/level-commands'
import { documentStore, useDocument } from '../store/store'
import { GAP } from './edges'
import { useCover } from './use-cover'

/**
 * Which storey of the house is being drawn, at the head of the plan.
 *
 * A plan is one storey at a time — that is what a floor plan is — so the one
 * thing you always need to know is which, and it belongs where you look first:
 * the middle of the top edge, over the plan rather than beside it.
 *
 * The card is the name and the count. Opened, it is the storeys to step
 * between and the ways to build another, the way the palette along the foot
 * opens onto what can be put down. A house of one storey still shows it: a
 * plan that never mentions storeys is a plan somebody will later be surprised
 * by.
 */
export function StoreyCard() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const [naming, setNaming] = useState<Naming | null>(null)

  const storeys = levelsOf(doc)
  const at = storeys.findIndex((storey) => storey.id === level)
  const here = storeys[at]
  if (!here) return null

  const name = (of: number, below: boolean) =>
    below ? 'Cellar' : of === 1 ? 'First floor' : `Floor ${of}`

  return (
    <div
      style={{ top: GAP }}
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
    >
      <Card>
        <DropdownMenu
          onOpenChange={(open) => {
            if (!open) setNaming(null)
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-xl px-3 text-sm font-medium"
              aria-label={`Storey: ${here.name}`}
            >
              <LayersIcon className="size-4 text-muted-foreground" />
              <span className="max-w-48 truncate">{here.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {at + 1}/{storeys.length}
              </span>
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="center" className="w-64">
            <DropdownMenuLabel>Storeys</DropdownMenuLabel>
            {/* Highest first, the way they stand in a section drawing. */}
            <DropdownMenuRadioGroup
              value={level}
              onValueChange={(id) => documentStore.getState().setLevel(id)}
            >
              {[...storeys].reverse().map((storey) => (
                <DropdownMenuRadioItem key={storey.id} value={storey.id}>
                  <span className="flex-1 truncate">{storey.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(storey.height / 1000).toFixed(2)} m
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            {/* Floor to floor, which is also how many risers a stair out of
                here climbs — so it is worth having where the storey is. */}
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Label htmlFor="storey-height" className="flex-1 text-xs text-muted-foreground">
                Floor to floor (mm)
              </Label>
              <Input
                id="storey-height"
                key={`${here.id}-${here.height}`}
                type="number"
                defaultValue={here.height}
                className="h-8 w-24"
                onKeyDown={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  const height = Number(event.target.value)
                  if (Number.isFinite(height) && height > 0 && height !== here.height) {
                    setStoreyHeight(here.id, Math.round(height))
                  }
                }}
              />
            </div>

            <DropdownMenuSeparator />
            {naming ? (
              <NameField
                placeholder={
                  naming.kind === 'rename' ? here.name : name(storeys.length, naming.below)
                }
                onDone={(called) => {
                  if (called === null) return setNaming(null)
                  if (naming.kind === 'rename') renameStorey(here.id, called || here.name)
                  else
                    addStorey(called || name(storeys.length, naming.below), { below: naming.below })
                  setNaming(null)
                }}
              />
            ) : (
              <>
                <DropdownMenuItem onSelect={hold(() => setNaming({ kind: 'add', below: false }))}>
                  <PlusIcon />
                  Add a storey above
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={hold(() => setNaming({ kind: 'add', below: true }))}>
                  <PlusIcon />
                  Add one below
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={hold(() => setNaming({ kind: 'rename' }))}>
                  <PencilIcon />
                  Rename {here.name}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={storeys.length < 2}
                  onSelect={() => removeStorey(here.id)}
                >
                  <TrashIcon />
                  Take this storey out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
    </div>
  )
}

/** What the field being typed into is for: a new storey above or below, or this one's name. */
type Naming = { kind: 'add'; below: boolean } | { kind: 'rename'; below?: undefined }

/** Keeps the menu open, because what the item does is ask for a name in it. */
const hold = (run: () => void) => (event: Event) => {
  event.preventDefault()
  run()
}

/** The card itself, which is what says how far in from the top edge it hangs. */
function Card({ children }: { children: React.ReactNode }) {
  const ref = useCover<HTMLDivElement>('top')
  return (
    <div ref={ref} className="glass pointer-events-auto flex h-10 items-center rounded-xl border">
      {children}
    </div>
  )
}

/**
 * Naming a storey, in the menu rather than in a dialogue over it. Enter takes
 * what is typed, or the placeholder if nothing is; Escape takes nothing at all,
 * which is the difference between naming a storey and deciding against one.
 */
function NameField({
  placeholder,
  onDone,
}: {
  placeholder: string
  onDone: (name: string | null) => void
}) {
  const [name, setName] = useState('')
  return (
    <div className="px-1 py-1">
      <Input
        autoFocus
        value={name}
        placeholder={placeholder}
        className="h-8"
        onChange={(event) => setName(event.target.value)}
        // The menu would otherwise take the letters as a way of jumping to items.
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') onDone(name.trim())
          if (event.key === 'Escape') onDone(null)
        }}
      />
    </div>
  )
}
