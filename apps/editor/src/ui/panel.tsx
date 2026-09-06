import { surveyRoom } from '@houseit/commands/survey'
import type { HouseObject, Opening, Wall } from '@houseit/core/document'
import { FLOOR_MATERIALS } from '@houseit/core/floor-materials'
import { objectType } from '@houseit/core/object-types'
import { ROOM_KINDS, roomKindOf } from '@houseit/core/room-kinds'
import { SURFACES } from '@houseit/core/surfaces'
import { interiorSize } from '@houseit/geometry/dimensions'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { type ReactNode, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { finish, remove, resize, roomOf, turnTo } from '../edit/object-commands'
import { removeOpening, setOpening, whereOpening } from '../edit/opening-commands'
import { layFloor, rename, setKind } from '../edit/room-commands'
import { type CutRequest, cutRoom } from '../edit/shape-commands'
import { knockThrough, nameWall } from '../edit/wall-commands'
import { selectionStore, useSelection } from '../store/selection'
import { useDocument } from '../store/store'
import { FloorSwatch, KindIcon, SurfaceSwatch } from './avatars'

export function PanelContent() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const selected = useSelection((state) => state.selected)

  if (!selected) {
    return (
      <p className="text-xs leading-5 text-muted-foreground">
        Pick a room, a thing, a door or a wall to see it here. Drag things and openings to move
        them, drag a wall across itself; R turns, Delete removes, ⌘Z undoes.
      </p>
    )
  }

  if (selected.kind === 'room') {
    const room = roomsOf(doc, level).find((candidate) => candidate.id === selected.id)
    return room ? <RoomPanel room={room} /> : null
  }
  if (selected.kind === 'object') {
    const object = doc.objects[selected.id]
    return object ? <ObjectPanel object={object} /> : null
  }
  if (selected.kind === 'opening') {
    const opening = doc.openings[selected.id]
    return opening ? <OpeningPanel opening={opening} /> : null
  }
  const wall = doc.walls[selected.id]
  return wall ? <WallPanel wall={wall} /> : null
}

function WallPanel({ wall }: { wall: Wall }) {
  const doc = useDocument((state) => state.doc)
  const a = doc.nodes[wall.a]
  const b = doc.nodes[wall.b]
  const length = a && b ? Math.round(Math.hypot(b.x - a.x, b.y - a.y)) : 0
  const named = nameWall(wall)
  return (
    <>
      <Heading>Wall</Heading>
      <Facts
        rows={[
          ['Length', `${length} mm`],
          ['Thickness', `${wall.thickness} mm`],
          ['Bounds', named ? `${named.room.name}, ${named.side} side` : '—'],
        ]}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Drag the wall across itself to move it; the walls meeting it follow. A stub's free end has a
        handle to pull it; Delete takes a stub out.
      </p>
    </>
  )
}

function RoomPanel({ room }: { room: Room }) {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const size = interiorSize(doc, level, room)
  const kind = roomKindOf(room)

  return (
    <>
      <Heading>Room</Heading>
      <Field label="Name">
        <TextField value={room.name ?? ''} onCommit={(name) => rename(room, name)} />
      </Field>
      <Field label="Kind">
        <Select
          value={room.kind ?? 'none'}
          onValueChange={(value) => value !== 'none' && setKind(room, value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <KindIcon id={kind?.id} />
              {kind ? `${kind.label} (from the name)` : 'not said'}
            </SelectItem>
            {ROOM_KINDS.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <KindIcon id={entry.id} />
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Floor">
        <Select value={room.floor ?? 'bare'} onValueChange={(value) => layFloor(room, value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bare">
              <FloorSwatch id={undefined} />
              bare
            </SelectItem>
            {FLOOR_MATERIALS.map((material) => (
              <SelectItem key={material.id} value={material.id}>
                <FloorSwatch id={material.id} />
                {material.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Facts
        rows={[
          ['Clear size', `${size.width} × ${size.depth} mm`],
          ['Area', `${(room.area / 1_000_000).toFixed(1)} m²`],
        ]}
      />
      <Separator />
      <CutRoom room={room} />
      <KnockThrough room={room} />
    </>
  )
}

const WHERE: CutRequest['where'][] = [
  'west',
  'east',
  'north',
  'south',
  'north-west',
  'north-east',
  'south-west',
  'south-east',
]

function CutRoom({ room }: { room: Room }) {
  const [where, setWhere] = useState<CutRequest['where']>('west')
  const [width, setWidth] = useState('3000')
  const [depth, setDepth] = useState('3000')
  const [name, setName] = useState('')
  const corner = where.includes('-')
  return (
    <div className="flex flex-col gap-3">
      <Heading>Cut off a room</Heading>
      <Field label="Where">
        <Select value={where} onValueChange={(value) => setWhere(value as CutRequest['where'])}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WHERE.map((option) => (
              <SelectItem key={option} value={option}>
                {option.includes('-') ? `${option} corner` : `${option} side`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width (mm)">
          <Input inputMode="numeric" value={width} onChange={(e) => setWidth(e.target.value)} />
        </Field>
        <Field label="Depth (mm)">
          <Input
            inputMode="numeric"
            value={corner ? depth : ''}
            disabled={!corner}
            placeholder={corner ? '' : 'right across'}
            onChange={(e) => setDepth(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="new room" />
      </Field>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const done = cutRoom(room, {
            where,
            width: Number(width),
            ...(corner ? { depth: Number(depth) } : {}),
            name: name.trim() || 'room',
            material: room.floor ?? 'natural-oak',
          })
          if (done) setName('')
        }}
      >
        Cut
      </Button>
    </div>
  )
}

function KnockThrough({ room }: { room: Room }) {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const neighbours = surveyRoom(doc, level, room).neighbours
  const [into, setInto] = useState('')
  if (neighbours.length === 0) return null
  return (
    <Field label="Knock through into">
      <div className="flex gap-1">
        <Select value={into} onValueChange={setInto}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {neighbours.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={into === ''}
          onClick={() => {
            if (knockThrough(room, into)) selectionStore.getState().select(null)
          }}
        >
          Go
        </Button>
      </div>
    </Field>
  )
}

function ObjectPanel({ object }: { object: HouseObject }) {
  const type = objectType(object.type)
  const room = roomOf(object)
  const surfaces = SURFACES.filter((surface) => type?.surfaces.includes(surface.id))

  return (
    <>
      <Heading>{type?.label ?? object.type}</Heading>
      <Field label="Finish">
        <Select value={object.surface} onValueChange={(value) => finish(object, value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {surfaces.map((surface) => (
              <SelectItem key={surface.id} value={surface.id}>
                <SurfaceSwatch id={surface.id} />
                {surface.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width (mm)">
          <NumberField value={object.width} onCommit={(width) => resize(object, { width })} />
        </Field>
        <Field label="Depth (mm)">
          <NumberField value={object.depth} onCommit={(depth) => resize(object, { depth })} />
        </Field>
      </div>
      <Field label="Turn (°)">
        <NumberField
          value={object.rotation ?? 0}
          onCommit={(rotation) => turnTo(object, rotation)}
        />
      </Field>
      <Facts
        rows={[
          ['Room', room?.name ?? '—'],
          [
            'Stands',
            object.against
              ? `against the ${object.against} wall at ${object.along}`
              : `free at ${object.along} along, ${object.across ?? 0.5} across`,
          ],
        ]}
      />
      <Button
        variant="outline"
        size="sm"
        className="hover:border-destructive hover:text-destructive"
        onClick={() => {
          remove(object)
          selectionStore.getState().select(null)
        }}
      >
        Remove
      </Button>
    </>
  )
}

function OpeningPanel({ opening }: { opening: Opening }) {
  const where = whereOpening(opening)
  const isDoor = opening.kind === 'door'

  return (
    <>
      <Heading>{isDoor ? 'Door' : 'Window'}</Heading>
      {isDoor ? (
        <Field label="Kind">
          <Select
            value={opening.variant}
            onValueChange={(value) => setOpening(opening, { variant: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['hinged', 'sliding', 'pocket', 'garage'].map((variant) => (
                <SelectItem key={variant} value={variant}>
                  {variant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field label="Width (mm)">
        <NumberField value={opening.width} onCommit={(width) => setOpening(opening, { width })} />
      </Field>
      {isDoor ? null : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Height (mm)">
            <NumberField
              value={opening.height}
              onCommit={(height) => setOpening(opening, { height })}
            />
          </Field>
          <Field label="Sill (mm)">
            <NumberField
              value={opening.sillHeight}
              onCommit={(sill) => setOpening(opening, { sill })}
            />
          </Field>
        </div>
      )}
      <Facts
        rows={[
          ['Room', where?.room.name ?? '—'],
          ['Wall', where ? `${where.side}, ${opening.wall}` : '—'],
        ]}
      />
      <Button
        variant="outline"
        size="sm"
        className="hover:border-destructive hover:text-destructive"
        onClick={() => {
          removeOpening(opening)
          selectionStore.getState().select(null)
        }}
      >
        Remove
      </Button>
    </>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map(([term, detail]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="text-foreground">{detail}</dd>
        </div>
      ))}
    </dl>
  )
}

function TextField({ value, onCommit }: { value: string; onCommit: (value: string) => boolean }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft === value) return
    if (!onCommit(draft)) setDraft(value)
  }
  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        if (event.key === 'Escape') setDraft(value)
      }}
    />
  )
}

function NumberField({ value, onCommit }: { value: number; onCommit: (value: number) => boolean }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed === value) {
      setDraft(String(value))
      return
    }
    if (!onCommit(Math.round(parsed))) setDraft(String(value))
  }
  return (
    <Input
      inputMode="numeric"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        if (event.key === 'Escape') setDraft(String(value))
      }}
    />
  )
}
