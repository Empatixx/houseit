import type { HouseObject, Opening, Wall } from '@houseit/core/document'
import { finishesFor, finishOf, type Part, STYLES, styleOf } from '@houseit/core/finishes'
import { FLOOR_MATERIALS, floorMaterial } from '@houseit/core/floor-materials'
import { CAMERA, objectType } from '@houseit/core/object-types'
import { ROOM_KINDS, roomKindOf } from '@houseit/core/room-kinds'
import { SURFACES } from '@houseit/core/surfaces'
import { interiorSize } from '@houseit/geometry/dimensions'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { standingAt } from '@houseit/geometry/standing'
import {
  BlindsIcon,
  BrickWallIcon,
  CameraIcon,
  DoorOpenIcon,
  LayersIcon,
  PaletteIcon,
  PanelTopIcon,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
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
import { sayError } from '../edit/notice'
import { finish, placeCamera, remove, resize, roomOf, turnTo } from '../edit/object-commands'
import { removeOpening, setOpening, whereOpening } from '../edit/opening-commands'
import { pick } from '../edit/pick'
import { layFloor, setFinish, setKind, setStyle } from '../edit/room-commands'
import { promptFor, type Visualised, visualise } from '../edit/visualise'
import { nameWall } from '../edit/wall-commands'
import { selectionStore, useSelection } from '../store/selection'
import { useDocument } from '../store/store'
import { KindIcon } from './avatars'
import { CameraView } from './camera-view'
import { type Choice, FinishRow } from './finish-picker'

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
    if (!object) return null
    return object.type === CAMERA ? (
      <CameraPanel object={object} />
    ) : (
      <ObjectPanel object={object} />
    )
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

const FLOOR_CHOICES: Choice[] = FLOOR_MATERIALS.map((material) => ({
  id: material.id,
  label: material.label,
  picture: `textures/${material.texture}`,
}))

const WEARS: { part: Part; label: string; icon: ReactNode }[] = [
  { part: 'walls', label: 'Walls', icon: <BrickWallIcon /> },
  { part: 'ceiling', label: 'Ceiling', icon: <PanelTopIcon /> },
  { part: 'doors', label: 'Doors', icon: <DoorOpenIcon /> },
  { part: 'windows', label: 'Windows', icon: <BlindsIcon /> },
]

function RoomPanel({ room }: { room: Room }) {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const size = interiorSize(doc, level, room)
  const kind = roomKindOf(room)
  const record = room.id === undefined ? undefined : doc.rooms[room.id]
  const floor = floorMaterial(room.floor ?? '')

  return (
    <>
      <Heading>Room</Heading>
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
      <Facts
        rows={[
          ['Width', `${size.width} mm`],
          ['Depth', `${size.depth} mm`],
          ['Area', `${(room.clear / 1_000_000).toFixed(1)} m²`],
        ]}
      />
      <Separator />
      <Heading>Design preference</Heading>
      <FinishRow
        icon={<PaletteIcon />}
        label="Style"
        title="Add style"
        chosen={styleOf(record?.style)}
        choices={STYLES}
        onPick={(id) => setStyle(room, id)}
      />
      <Heading>Fine-tuning</Heading>
      <FinishRow
        icon={<LayersIcon />}
        label="Floor"
        title="Add finish"
        chosen={FLOOR_CHOICES.find((choice) => choice.id === floor?.id)}
        choices={FLOOR_CHOICES}
        onPick={(id) => layFloor(room, id)}
      />
      {WEARS.map(({ part, label, icon }) => (
        <FinishRow
          key={part}
          icon={icon}
          label={label}
          title="Add finish"
          chosen={finishOf(record?.[part])}
          choices={finishesFor(part)}
          onPick={(id) => setFinish(room, part, id)}
        />
      ))}
      <Separator />
      <Heading>Visualise</Heading>
      <p className="text-xs leading-5 text-muted-foreground">
        Put a camera in the room, turn it to face what you want to see, and generate a picture from
        there.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const id = placeCamera(room)
          if (id) pick({ kind: 'object', id })
        }}
      >
        <CameraIcon />
        Visualise
      </Button>
    </>
  )
}

function CameraPanel({ object }: { object: HouseObject }) {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const room = roomOf(object)
  const spot = room ? standingAt(doc, level, room, object) : undefined
  const record = room?.id === undefined ? undefined : doc.rooms[room.id]
  const suggested = promptFor(record)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [seen, setSeen] = useState<Visualised | null>(null)
  const eye = useRef<() => string | undefined>(() => undefined)
  const ready = useCallback((take: () => string | undefined) => {
    eye.current = take
  }, [])

  const generate = async () => {
    setBusy(true)
    try {
      setSeen(await visualise(prompt.trim() || suggested, () => eye.current()))
    } catch (error) {
      sayError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Heading>Camera</Heading>
      {spot ? <CameraView spot={spot} level={level} onReady={ready} /> : null}
      <Field label="Turn (°)">
        <NumberField
          value={object.rotation ?? 0}
          onCommit={(rotation) => turnTo(object, rotation)}
        />
      </Field>
      <Facts rows={[['Room', room?.name ?? '—']]} />
      <Separator />
      <Heading>Visualise</Heading>
      <Field label="Prompt">
        <textarea
          value={prompt}
          placeholder={suggested}
          rows={4}
          onChange={(event) => setPrompt(event.target.value)}
          className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>
      <Button size="sm" disabled={busy} onClick={() => void generate()}>
        {busy ? 'Generating…' : 'Generate'}
      </Button>
      {seen ? (
        <figure className="flex flex-col gap-1.5">
          <img
            src={seen.image}
            alt="What the camera sees"
            draggable={false}
            className="aspect-[4/3] w-full rounded-lg border object-cover"
          />
          <figcaption className="text-xs leading-5 text-muted-foreground">
            Not a render yet, the camera's own view. Asked for: {seen.prompt}
          </figcaption>
        </figure>
      ) : null}
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

function ObjectPanel({ object }: { object: HouseObject }) {
  const type = objectType(object.type)
  const room = roomOf(object)
  const surfaces: Choice[] = SURFACES.filter((surface) => type?.surfaces.includes(surface.id)).map(
    (surface) => ({
      id: surface.id,
      label: surface.label,
      colour: surface.fill,
      line: surface.line,
    }),
  )

  return (
    <>
      <Heading>{type?.label ?? object.type}</Heading>
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
      <Separator />
      <Heading>Design preference</Heading>
      <FinishRow
        icon={<PaletteIcon />}
        label="Finish"
        title="Add finish"
        chosen={surfaces.find((choice) => choice.id === object.surface)}
        choices={surfaces}
        onPick={(id) => finish(object, id)}
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
