import { SearchIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type Choice = {
  id: string
  label: string
  picture?: string
  colour?: string
  line?: string
}

const flat = (choice: Choice) =>
  choice.picture
    ? undefined
    : {
        background: choice.colour,
        boxShadow: choice.line ? `inset 0 0 0 1px ${choice.line}` : undefined,
      }

const BESIDE = 24

type FinishRowProps = {
  icon: ReactNode
  label: string
  title: string
  chosen: Choice | undefined
  choices: readonly Choice[]
  onPick: (id: string) => void
}

export function FinishRow({ icon, label, title, chosen, choices, onPick }: FinishRowProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wanted = search.trim().toLowerCase()
  const shown = choices.filter((choice) => choice.label.toLowerCase().includes(wanted))

  const show = (next: boolean) => {
    setOpen(next)
    if (!next) setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={show}>
      <PopoverAnchor asChild>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs text-muted-foreground [&>svg]:size-3.5">
            {icon}
            {label}
          </span>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${label}: ${chosen?.label ?? 'not chosen'}`}
              className="rounded-4xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Badge
                variant={chosen ? 'secondary' : 'outline'}
                className="cursor-pointer gap-1.5 has-[img]:pl-1"
              >
                {chosen ? <Swatch choice={chosen} /> : null}
                {chosen?.label ?? 'Choose'}
              </Badge>
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent side="left" align="start" sideOffset={BESIDE} className="w-72 p-0">
        <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
              aria-label={`Search ${label.toLowerCase()}`}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="grid max-h-80 grid-cols-2 gap-3 overflow-auto px-3 pb-3">
          {shown.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={choice.id === chosen?.id}
              onClick={() => {
                onPick(choice.id)
                show(false)
              }}
              className="group flex flex-col gap-1.5 text-left focus-visible:outline-none"
            >
              <Picture choice={choice} picked={choice.id === chosen?.id} />
              <span className="truncate text-xs">{choice.label}</span>
            </button>
          ))}
          {shown.length === 0 ? (
            <p className="col-span-2 text-xs text-muted-foreground">Nothing called that.</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Picture({ choice, picked }: { choice: Choice; picked: boolean }) {
  return (
    <span
      className={cn(
        'block aspect-square w-full overflow-hidden rounded-lg border transition-shadow group-hover:shadow-md group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50',
        picked && 'ring-2 ring-primary ring-offset-1',
      )}
      style={flat(choice)}
    >
      {choice.picture ? (
        <img
          src={`/${choice.picture}`}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      ) : null}
    </span>
  )
}

function Swatch({ choice }: { choice: Choice }) {
  return (
    <span
      className="block size-3.5 shrink-0 overflow-hidden rounded-full border"
      style={flat(choice)}
    >
      {choice.picture ? (
        <img
          src={`/${choice.picture}`}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      ) : null}
    </span>
  )
}
