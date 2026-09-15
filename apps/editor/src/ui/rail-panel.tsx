import { checkLevel, type Problem } from '@houseit/commands/checks'
import { removeSite } from '@houseit/commands/remove-site'
import { surveyLevel } from '@houseit/commands/survey'
import { objectType } from '@houseit/core/object-types'
import { roomKindOf } from '@houseit/core/room-kinds'
import { ChevronRightIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { SiteControls } from '../site/site-controls'
import { siteDialogStore } from '../site/site-dialog-store'
import { hoverStore } from '../store/hover'
import {
  MEASURED,
  type Measured,
  type Selection,
  selectionStore,
  useSelection,
} from '../store/selection'
import { useShell } from '../store/shell'
import { LAYERS, shownStore, useShown } from '../store/shown'
import { documentStore, useDocument } from '../store/store'
import { KindIcon } from './avatars'
import { GAP, RAIL_OPEN_WIDTH, RAIL_PANEL_WIDTH, RAIL_WIDTH } from './edges'
import { EngineSettings } from './engine-settings'
import { useCover } from './use-cover'

const TITLES = { plan: 'Plan', site: 'Site', issues: 'Issues', view: 'View' } as const

export function RailPanel() {
  const tab = useShell((state) => state.tab)
  const rail = useShell((state) => state.rail)
  const open = tab !== null
  const ref = useCover<HTMLElement>('left', open)
  const left = GAP + (rail ? RAIL_OPEN_WIDTH : RAIL_WIDTH) + GAP

  return (
    <aside
      ref={ref}
      inert={!open}
      aria-hidden={!open}
      aria-label={tab === null ? undefined : TITLES[tab]}
      style={{
        width: RAIL_PANEL_WIDTH,
        top: GAP,
        bottom: GAP,
        left,
        transform: open ? undefined : `translateX(${-(left + RAIL_PANEL_WIDTH)}px)`,
      }}
      className="glass absolute z-20 flex flex-col overflow-hidden rounded-xl border transition-[transform,left] duration-200 ease-linear"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pt-4 pb-4 text-sm">
        {tab === null ? null : <Heading>{TITLES[tab]}</Heading>}
        {tab === 'plan' ? <Plan /> : null}
        {tab === 'site' ? <Site /> : null}
        {tab === 'issues' ? <Issues /> : null}
        {tab === 'view' ? <View /> : null}
      </div>
    </aside>
  )
}

function Site() {
  const site = useDocument((state) => state.doc.parcelSite)

  if (!site) {
    return (
      <>
        <Empty>Attach a cadastral parcel to see its boundary behind the floor plan.</Empty>
        <Button onClick={() => siteDialogStore.getState().openFor({ kind: 'attach' })}>
          Choose parcel
        </Button>
      </>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-background/70 p-3">
        <p className="font-medium">Parcel {site.parcel.number}</p>
        <p className="text-xs text-muted-foreground">{site.parcel.cadastralAreaName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {site.parcel.areaM2.toLocaleString('cs-CZ')} m² · ČÚZK
        </p>
      </div>
      <p className="rounded-lg bg-amber-50 p-2 text-xs leading-4 text-amber-900">
        Indicative data. Verify boundaries and siting with a surveyor.
      </p>
      <SiteControls site={site} />
      <Button
        variant="outline"
        onClick={() => siteDialogStore.getState().openFor({ kind: 'attach' }, site)}
      >
        Open cadastral map
      </Button>
      <Button variant="destructive" onClick={() => documentStore.getState().apply(removeSite, {})}>
        Remove parcel
      </Button>
    </>
  )
}

function Plan() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const picked = useSelection((state) => state.selected)
  const [spread, setSpread] = useState<string | null>(null)
  const rooms = [...surveyLevel(doc, level).rooms].sort((one, other) => other.areaM2 - one.areaM2)

  if (rooms.length === 0) {
    return <Empty>Nothing is drawn on this storey yet. Cut a room and it appears here.</Empty>
  }

  const total = rooms.reduce((sum, room) => sum + room.areaM2, 0)

  return (
    <>
      <ul className="-mx-1.5 flex flex-col">
        {rooms.map((room) => {
          const inside = [
            ...room.openings.map((opening) => ({
              id: opening.id,
              kind: 'opening' as const,
              said: opening.kind === 'door' ? doorSaid(opening.variant, opening.to) : 'Window',
            })),
            ...room.objects.map((object) => ({
              id: object.id,
              kind: 'object' as const,
              said: objectType(object.type)?.label ?? object.type,
            })),
          ]
          const out = spread === room.id
          return (
            <li key={room.id ?? room.name}>
              <Row
                on={picks(picked, 'room', room.id)}
                before={
                  <Spread
                    out={out}
                    count={inside.length}
                    onSpread={() => setSpread(out ? null : (room.id ?? null))}
                  />
                }
                onEnter={() => reach(room.id, 'room', 'hover')}
                onClick={() => reach(room.id, 'room', 'select')}
              >
                <KindIcon id={roomKindOf(room)?.id} />
                <span className="min-w-0 flex-1 truncate">{room.name ?? 'Unnamed room'}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {room.areaM2.toFixed(1)} m²
                </span>
              </Row>
              {out ? (
                <ul className="flex flex-col">
                  {inside.map((thing) => (
                    <li key={thing.id}>
                      <Row
                        on={picks(picked, thing.kind, thing.id)}
                        onEnter={() => reach(thing.id, thing.kind, 'hover')}
                        onClick={() => reach(thing.id, thing.kind, 'select')}
                      >
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {thing.said}
                        </span>
                      </Row>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="mt-auto pt-2 text-xs text-muted-foreground">
        {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}, {total.toFixed(1)} m² of floor
      </p>
    </>
  )
}

function Issues() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const problems = checkLevel(doc, level)
  const rooms = surveyLevel(doc, level).rooms
  const idOf = (name: string | undefined) => rooms.find((room) => room.name === name)?.id

  if (problems.length === 0) {
    return <Empty>Nothing to fix on this storey.</Empty>
  }

  return (
    <>
      <ul className="-mx-1.5 flex flex-col">
        {problems.map((problem) => {
          const id = idOf(problem.room)
          const body = (
            <>
              <Severity of={problem} />
              <span className="min-w-0 flex-1 text-xs leading-5">{problem.message}</span>
            </>
          )
          return (
            <li key={`${problem.code}-${problem.room ?? ''}-${problem.message}`}>
              {id === undefined ? (
                <div className="flex items-start gap-2 py-1.5 pr-1.5 pl-6">{body}</div>
              ) : (
                <Row
                  on={false}
                  onEnter={() => hoverStore.getState().hover({ kind: 'room', id })}
                  onClick={() => selectionStore.getState().select({ kind: 'room', id })}
                >
                  {body}
                </Row>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-auto pt-2 text-xs text-muted-foreground">{count(problems)}</p>
    </>
  )
}

function View() {
  const shown = useShown((state) => state.shown)
  const measured = useSelection((state) => state.measured)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {LAYERS.map((layer) => (
          <li key={layer.id} className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <Label htmlFor={layer.id} className="font-normal text-sm">
                {layer.label}
              </Label>
              <span className="block text-xs leading-4 text-muted-foreground">{layer.note}</span>
            </span>
            <Switch
              id={layer.id}
              checked={shown[layer.id]}
              onCheckedChange={(on) => shownStore.getState().show(layer.id, on)}
            />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col gap-1.5">
        <Label htmlFor="measurements" className="font-normal text-sm">
          Measurements
        </Label>
        <Select
          value={measured}
          onValueChange={(value) => selectionStore.getState().measure(value as Measured)}
        >
          <SelectTrigger id="measurements" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEASURED.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <EngineSettings />
    </>
  )
}

function Spread({ out, count, onSpread }: { out: boolean; count: number; onSpread: () => void }) {
  if (count === 0) return <span className="w-6 shrink-0" />
  return (
    <button
      type="button"
      aria-label={out ? 'Fold away' : 'Open up'}
      aria-expanded={out}
      onClick={onSpread}
      className="w-6 shrink-0 py-1.5 text-muted-foreground"
    >
      <ChevronRightIcon
        className={cn('mx-auto size-4 transition-transform', out ? 'rotate-90' : undefined)}
      />
    </button>
  )
}

function Severity({ of }: { of: Problem }) {
  return (
    <span
      aria-label={of.severity === 'error' ? 'Error' : 'Warning'}
      className={cn(
        'mt-1.5 size-2 shrink-0 rounded-full',
        of.severity === 'error' ? 'bg-destructive' : 'bg-muted-foreground/50',
      )}
    />
  )
}

function Row({
  on,
  before,
  onEnter,
  onClick,
  children,
}: {
  on: boolean
  before?: ReactNode
  onEnter: () => void
  onClick: () => void
  children: ReactNode
}) {
  return (
    <div
      onPointerEnter={onEnter}
      onPointerLeave={() => hoverStore.getState().hover(null)}
      className={cn(
        'flex items-start rounded-md pr-1.5 transition-colors',
        on ? 'bg-secondary' : 'hover:bg-foreground/5',
      )}
    >
      {before ?? <span className="w-6 shrink-0" />}
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start gap-2 py-1.5 text-left"
      >
        {children}
      </button>
    </div>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
      {children}
    </h2>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-muted-foreground">{children}</p>
}

const picks = (picked: Selection | null, kind: Selection['kind'], id: string | undefined) =>
  picked?.kind === kind && picked.id === id

function reach(id: string | undefined, kind: Selection['kind'], how: 'hover' | 'select'): void {
  if (id === undefined) return
  if (how === 'hover') hoverStore.getState().hover({ kind, id })
  else selectionStore.getState().select({ kind, id })
}

function doorSaid(variant: string | undefined, to: string | undefined): string {
  const kind =
    variant === undefined || variant === 'hinged'
      ? 'Door'
      : `${variant[0]!.toUpperCase()}${variant.slice(1)} door`
  return `${kind} to ${to ?? 'outside'}`
}

function count(problems: Problem[]): string {
  const errors = problems.filter((problem) => problem.severity === 'error').length
  const warnings = problems.length - errors
  return [
    errors > 0 ? `${errors} ${errors === 1 ? 'error' : 'errors'}` : undefined,
    warnings > 0 ? `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ')
}
