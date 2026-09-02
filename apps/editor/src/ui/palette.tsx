import { OBJECT_TYPES } from '@houseit/core/object-types'
import { type ReactNode, useMemo, useState } from 'react'
import { type Armed, toolStore, useTool } from '../store/tool'

/**
 * What can be put on the plan: every door, the window, and the catalogue of
 * things, by name. Clicking one arms it; the next click on a room puts it
 * there. It is a list to read, not a drawer of pictures to open — the
 * pictures are what the plan shows once the thing is in it.
 */
export function Palette() {
  const armed = useTool((state) => state.armed)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const categories = useMemo(
    () =>
      [...new Set(OBJECT_TYPES.flatMap((type) => type.rooms ?? []))]
        .filter((room) => room !== 'any')
        .sort(),
    [],
  )
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return OBJECT_TYPES.filter(
      (type) =>
        (category === '' || type.rooms?.includes(category)) &&
        (needle === '' || type.label.toLowerCase().includes(needle) || type.id.includes(needle)),
    ).sort((one, other) => one.label.localeCompare(other.label))
  }, [search, category])

  const arm = (next: Armed) => toolStore.getState().arm(same(armed, next) ? null : next)

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-2 border-r border-neutral-200 bg-white px-3 py-3 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Add</h2>
      <div className="flex flex-wrap gap-1">
        {(['hinged', 'sliding', 'pocket', 'garage'] as const).map((variant) => (
          <Chip
            key={variant}
            armed={armed?.kind === 'door' && armed.variant === variant}
            onClick={() => arm({ kind: 'door', variant })}
          >
            {variant} door
          </Chip>
        ))}
        <Chip armed={armed?.kind === 'window'} onClick={() => arm({ kind: 'window' })}>
          window
        </Chip>
        <Chip armed={armed?.kind === 'wall'} onClick={() => arm({ kind: 'wall' })}>
          wall
        </Chip>
      </div>
      <input
        className={INPUT}
        placeholder="Search things…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        className={INPUT}
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      >
        <option value="">every room</option>
        {categories.map((room) => (
          <option key={room} value={room}>
            {room.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
      <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto">
        {shown.map((type) => {
          const on = armed?.kind === 'object' && armed.type === type.id
          return (
            <li key={type.id}>
              <button
                type="button"
                className={`flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-neutral-100 ${on ? 'bg-blue-50 text-blue-700' : ''}`}
                onClick={() => arm({ kind: 'object', type: type.id })}
              >
                <span className="truncate">{type.label}</span>
                <span className="shrink-0 text-[10px] text-neutral-400">
                  {Math.round(type.size.width / 10) / 100}×{Math.round(type.size.depth / 10) / 100}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] leading-4 text-neutral-500">
        {armed?.kind === 'wall'
          ? 'Drag from a wall into a room: as far as you drag, or right across if you reach the far wall. Escape lets go.'
          : armed
            ? 'Click a room to put it there. Shift keeps it armed; Escape lets go.'
            : 'Pick something, then click where it goes.'}
      </p>
    </aside>
  )
}

const INPUT =
  'w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 outline-none focus:border-neutral-500'

function Chip({
  armed,
  onClick,
  children,
}: {
  armed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={armed}
      className={`rounded border px-1.5 py-0.5 text-xs ${armed ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-neutral-300 text-neutral-700 hover:border-neutral-400'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

const same = (one: Armed | null, other: Armed) =>
  one !== null && JSON.stringify(one) === JSON.stringify(other)
