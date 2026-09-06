import { OBJECT_TYPES, type ObjectType, objectType } from '@houseit/core/object-types'
import {
  ArmchairIcon,
  ArrowLeftRightIcon,
  BathIcon,
  BedDoubleIcon,
  BlindsIcon,
  BriefcaseIcon,
  CookingPotIcon,
  DoorClosedIcon,
  DoorOpenIcon,
  DumbbellIcon,
  FootprintsIcon,
  Gamepad2Icon,
  type LucideIcon,
  MousePointer2Icon,
  PackageIcon,
  PartyPopperIcon,
  PenLineIcon,
  SearchIcon,
  ShirtIcon,
  ShoppingBasketIcon,
  SofaIcon,
  ToiletIcon,
  TvIcon,
  UtensilsCrossedIcon,
  WarehouseIcon,
  XIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type Armed, toolStore, useTool } from '../store/tool'
import { useLeftEdge, useRightEdge } from './edges'
import { useCover } from './use-cover'

export function BottomBar() {
  const armed = useTool((state) => state.armed)
  const label = armedLabel(armed)
  const ref = useCover<HTMLDivElement>('bottom')
  const left = useLeftEdge()
  const right = useRightEdge()

  return (
    <div
      ref={ref}
      style={{ left, right }}
      className="pointer-events-none absolute bottom-4 flex flex-col items-center gap-2 transition-[left,right] duration-200 ease-linear"
    >
      {label ? (
        <Badge variant="secondary" className="pointer-events-auto gap-1 pr-1">
          {label}
          <span className="text-muted-foreground">
            {armed?.kind === 'wall' ? '· click corners, Enter finishes' : '· click a room'}
          </span>
          <button
            type="button"
            className="ml-1 rounded-sm p-0.5 hover:bg-foreground/10"
            aria-label="Let go"
            onClick={() => toolStore.getState().arm(null)}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ) : null}
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl border p-1.5">
        <FurnitureMenu />
        <StructureMenu />
        <Separator orientation="vertical" className="mx-1 h-6!" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              aria-label="Select"
              pressed={armed === null}
              onPressedChange={() => toolStore.getState().arm(null)}
            >
              <MousePointer2Icon />
              Select
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Pick and drag what is on the plan</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              aria-label="Draw wall"
              pressed={armed?.kind === 'wall'}
              onPressedChange={(on) => toolStore.getState().arm(on ? { kind: 'wall' } : null)}
            >
              <PenLineIcon />
              Draw wall
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            Click to put corners down, square to the last; click the last corner or press Enter to
            finish, Escape to throw it away
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function armedLabel(armed: Armed | null): string | null {
  if (!armed) return null
  if (armed.kind === 'object') return objectType(armed.type)?.label ?? armed.type
  if (armed.kind === 'door') return `${armed.variant} door`
  if (armed.kind === 'window') return 'window'
  return 'wall'
}

const CATEGORIES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'living_room', label: 'Living room', icon: SofaIcon },
  { id: 'family_room', label: 'Family room', icon: TvIcon },
  { id: 'dining_room', label: 'Dining room', icon: UtensilsCrossedIcon },
  { id: 'kitchen', label: 'Kitchen', icon: CookingPotIcon },
  { id: 'bedroom', label: 'Bedroom', icon: BedDoubleIcon },
  { id: 'walk_in', label: 'Walk-in', icon: ShirtIcon },
  { id: 'full_bathroom', label: 'Bathroom', icon: BathIcon },
  { id: 'half_bathroom', label: 'Half bath', icon: ToiletIcon },
  { id: 'office', label: 'Office', icon: BriefcaseIcon },
  { id: 'entry', label: 'Entry', icon: FootprintsIcon },
  { id: 'pantry', label: 'Pantry', icon: ShoppingBasketIcon },
  { id: 'home_gym', label: 'Gym', icon: DumbbellIcon },
  { id: 'recreation_room', label: 'Recreation', icon: PartyPopperIcon },
  { id: 'game_room', label: 'Games', icon: Gamepad2Icon },
  { id: 'any', label: 'General', icon: PackageIcon },
]

const byLabel = (one: ObjectType, other: ObjectType) => one.label.localeCompare(other.label)

function inCategory(category: string): ObjectType[] {
  return OBJECT_TYPES.filter((type) => {
    const rooms = type.rooms ?? ['any']
    const particular = rooms.filter((room) => room !== 'any')
    return category === 'any' ? particular.length === 0 : particular.includes(category)
  }).sort(byLabel)
}

function FurnitureMenu() {
  const [search, setSearch] = useState('')
  const armed = useTool((state) => state.armed)
  const found = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return []
    return OBJECT_TYPES.filter(
      (type) => type.label.toLowerCase().includes(needle) || type.id.includes(needle),
    )
      .sort(byLabel)
      .slice(0, 24)
  }, [search])
  const arm = (type: string) => toolStore.getState().arm({ kind: 'object', type })
  const size = (type: ObjectType) =>
    `${(type.size.width / 1000).toFixed(2)} × ${(type.size.depth / 1000).toFixed(2)} m`

  return (
    <DropdownMenu onOpenChange={(open) => !open && setSearch('')}>
      <DropdownMenuTrigger asChild>
        <Button variant={armed?.kind === 'object' ? 'secondary' : 'ghost'}>
          <ArmchairIcon />
          Furniture
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="w-64">
        <div className="relative px-1 pt-1 pb-2">
          <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search furniture…"
            className="h-8 pl-8"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </div>
        {search.trim() ? (
          found.length === 0 ? (
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              Nothing called that
            </DropdownMenuLabel>
          ) : (
            found.map((type) => (
              <DropdownMenuItem key={type.id} onSelect={() => arm(type.id)}>
                <span className="flex-1 truncate">{type.label}</span>
                <span className="text-xs text-muted-foreground">{size(type)}</span>
              </DropdownMenuItem>
            ))
          )
        ) : (
          <>
            <DropdownMenuSeparator />
            {CATEGORIES.map((category) => {
              const types = inCategory(category.id)
              if (types.length === 0) return null
              return (
                <DropdownMenuSub key={category.id}>
                  <DropdownMenuSubTrigger>
                    <category.icon className="size-4 text-muted-foreground" />
                    {category.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-96 w-64 overflow-y-auto">
                    {types.map((type) => (
                      <DropdownMenuItem key={type.id} onSelect={() => arm(type.id)}>
                        <span className="flex-1 truncate">{type.label}</span>
                        <span className="text-xs text-muted-foreground">{size(type)}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const DOORS: {
  variant: 'hinged' | 'sliding' | 'pocket' | 'garage'
  label: string
  icon: LucideIcon
}[] = [
  { variant: 'hinged', label: 'Hinged door', icon: DoorOpenIcon },
  { variant: 'sliding', label: 'Sliding door', icon: ArrowLeftRightIcon },
  { variant: 'pocket', label: 'Pocket door', icon: DoorClosedIcon },
  { variant: 'garage', label: 'Garage door', icon: WarehouseIcon },
]

function StructureMenu() {
  const armed = useTool((state) => state.armed)
  const structural = armed?.kind === 'door' || armed?.kind === 'window'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={structural ? 'secondary' : 'ghost'}>
          <DoorOpenIcon />
          Structure
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="w-52">
        <DropdownMenuLabel>Doors</DropdownMenuLabel>
        {DOORS.map((door) => (
          <DropdownMenuItem
            key={door.variant}
            onSelect={() => toolStore.getState().arm({ kind: 'door', variant: door.variant })}
          >
            <door.icon className="size-4 text-muted-foreground" />
            {door.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Windows</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => toolStore.getState().arm({ kind: 'window' })}>
          <BlindsIcon className="size-4 text-muted-foreground" />
          Window
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
