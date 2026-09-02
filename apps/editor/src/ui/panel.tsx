import { surveyRoom } from '@houseit/commands/survey'
import type { HouseObject, Opening, Wall } from '@houseit/core/document'
import { FLOOR_MATERIALS } from '@houseit/core/floor-materials'
import { objectType } from '@houseit/core/object-types'
import { ROOM_KINDS, roomKindOf } from '@houseit/core/room-kinds'
import { SURFACES } from '@houseit/core/surfaces'
import { interiorSize } from '@houseit/geometry/dimensions'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { type ReactNode, useEffect, useState } from 'react'
import { finish, nameObject, remove, resize, turnTo } from '../edit/object-commands'
import { nameOpening, removeOpening, setOpening } from '../edit/opening-commands'
import { layFloor, rename, setKind } from '../edit/room-commands'
import { knockThrough, nameWall } from '../edit/wall-commands'
import { selectionStore, useSelection } from '../store/selection'
import { useDocument } from '../store/store'

/**
 * What is picked, and what can be said about it: a room's name, kind and
 * floor; a thing's finish, size and turn; a door's kind and width. Every
 * field ends in the command an agent would give, through the same store —
 * the panel is another way of typing it, not another way of changing the plan.
 */
export function Panel() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const selected = useSelection((state) => state.selected)

  if (!selected) {
    return (
      <aside className={SHELL}>
        <p className="text-xs text-neutral-500">
          Pick a room, a thing or a door to see it here. Drag things and openings to move them; R
          turns, Delete removes, ⌘Z undoes.
        </p>
      </aside>
    )
  }

  if (selected.kind === 'room') {
    const room = roomsOf(doc, level).find((candidate) => candidate.id === selected.id)
    return <aside className={SHELL}>{room ? <RoomPanel room={room} /> : null}</aside>
  }
  if (selected.kind === 'object') {
    const object = doc.objects[selected.id]
    return <aside className={SHELL}>{object ? <ObjectPanel object={object} /> : null}</aside>
  }
  if (selected.kind === 'opening') {
    const opening = doc.openings[selected.id]
    return <aside className={SHELL}>{opening ? <OpeningPanel opening={opening} /> : null}</aside>
  }
  const wall = doc.walls[selected.id]
  return <aside className={SHELL}>{wall ? <WallPanel wall={wall} /> : null}</aside>
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
      <p className="text-xs text-neutral-500">
        Drag the wall across itself to move it; the walls meeting it follow.
      </p>
    </>
  )
}

const SHELL =
  'flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l border-neutral-200 bg-white px-3 py-3 text-sm'

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
        <select
          className={INPUT}
          value={room.kind ?? ''}
          onChange={(event) => setKind(room, event.target.value)}
        >
          <option value="">{kind ? `${kind.label} (from the name)` : 'not said'}</option>
          {ROOM_KINDS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Floor">
        <select
          className={INPUT}
          value={room.floor ?? ''}
          onChange={(event) => layFloor(room, event.target.value)}
        >
          <option value="">bare</option>
          {FLOOR_MATERIALS.map((material) => (
            <option key={material.id} value={material.id}>
              {material.label}
            </option>
          ))}
        </select>
      </Field>
      <Facts
        rows={[
          ['Clear size', `${size.width} × ${size.depth} mm`],
          ['Area', `${(room.area / 1_000_000).toFixed(1)} m²`],
        ]}
      />
      <KnockThrough room={room} />
    </>
  )
}

/** Knocks the room through into one of its neighbours, and the room is gone. */
function KnockThrough({ room }: { room: Room }) {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const neighbours = surveyRoom(doc, level, room).neighbours
  const [into, setInto] = useState('')
  if (neighbours.length === 0) return null
  return (
    <Field label="Knock through into">
      <div className="flex gap-1">
        <select className={INPUT} value={into} onChange={(event) => setInto(event.target.value)}>
          <option value="">—</option>
          {neighbours.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${BUTTON} mt-0 shrink-0`}
          disabled={into === ''}
          onClick={() => {
            if (knockThrough(room, into)) selectionStore.getState().select(null)
          }}
        >
          Go
        </button>
      </div>
    </Field>
  )
}

function ObjectPanel({ object }: { object: HouseObject }) {
  const type = objectType(object.type)
  const named = nameObject(object)
  const surfaces = SURFACES.filter((surface) => type?.surfaces.includes(surface.id))

  return (
    <>
      <Heading>{type?.label ?? object.type}</Heading>
      <Field label="Finish">
        <select
          className={INPUT}
          value={object.surface}
          onChange={(event) => finish(object, event.target.value)}
        >
          {surfaces.map((surface) => (
            <option key={surface.id} value={surface.id}>
              {surface.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width">
          <NumberField value={object.width} onCommit={(width) => resize(object, { width })} />
        </Field>
        <Field label="Depth">
          <NumberField value={object.depth} onCommit={(depth) => resize(object, { depth })} />
        </Field>
      </div>
      <Field label="Turn (°)">
        <NumberField value={object.turn ?? 0} onCommit={(turn) => turnTo(object, turn)} />
      </Field>
      <Facts
        rows={[
          ['Room', named?.room.name ?? '—'],
          [
            'Stands',
            object.against
              ? `against the ${object.against} wall at ${object.along}`
              : `free at ${object.along} along, ${object.across ?? 0.5} across`,
          ],
        ]}
      />
      <button
        type="button"
        className={BUTTON}
        onClick={() => {
          remove(object)
          selectionStore.getState().select(null)
        }}
      >
        Remove
      </button>
    </>
  )
}

function OpeningPanel({ opening }: { opening: Opening }) {
  const named = nameOpening(opening)
  const isDoor = opening.kind === 'door'

  return (
    <>
      <Heading>{isDoor ? 'Door' : 'Window'}</Heading>
      {isDoor ? (
        <Field label="Kind">
          <select
            className={INPUT}
            value={opening.variant}
            onChange={(event) => setOpening(opening, { variant: event.target.value })}
          >
            {['hinged', 'sliding', 'pocket', 'garage'].map((variant) => (
              <option key={variant} value={variant}>
                {variant}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Width">
        <NumberField value={opening.width} onCommit={(width) => setOpening(opening, { width })} />
      </Field>
      {isDoor ? null : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Height">
            <NumberField
              value={opening.height}
              onCommit={(height) => setOpening(opening, { height })}
            />
          </Field>
          <Field label="Sill">
            <NumberField
              value={opening.sillHeight}
              onCommit={(sill) => setOpening(opening, { sill })}
            />
          </Field>
        </div>
      )}
      <Facts
        rows={[
          ['Room', named?.room.name ?? '—'],
          ['Wall', named ? `${named.side}${named.nth > 1 ? `, no. ${named.nth}` : ''}` : '—'],
        ]}
      />
      <button
        type="button"
        className={BUTTON}
        onClick={() => {
          removeOpening(opening)
          selectionStore.getState().select(null)
        }}
      >
        Remove
      </button>
    </>
  )
}

const INPUT =
  'w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 outline-none focus:border-neutral-500'
const BUTTON =
  'mt-1 rounded border border-neutral-300 bg-white px-2.5 py-1 text-sm text-neutral-700 hover:border-red-400 hover:text-red-600'

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</h2>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      {children}
    </label>
  )
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map(([term, detail]) => (
        <div key={term} className="contents">
          <dt className="text-neutral-500">{term}</dt>
          <dd className="text-neutral-800">{detail}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A text field that commits on Enter or on leaving, and goes back to what the
 * plan says when the plan refuses — the plan is the truth, not the field.
 */
function TextField({ value, onCommit }: { value: string; onCommit: (value: string) => boolean }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft === value) return
    if (!onCommit(draft)) setDraft(value)
  }
  return (
    <input
      className={INPUT}
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

/** Millimetres or degrees, committed the same way. */
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
    <input
      className={INPUT}
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
