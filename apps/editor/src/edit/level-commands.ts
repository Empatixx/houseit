import { addLevel, removeLevel, updateLevel } from '@houseit/commands/add-level'
import { levelsOf } from '@houseit/core/levels'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

/**
 * What the storey card does, as the commands an agent would give.
 *
 * A storey added is stepped onto straight away — nobody adds a floor in order
 * to keep looking at the one under it — and a storey taken out leaves you on
 * whatever is nearest, since the one you were standing on has gone.
 */

export function addStorey(name: string, options: { below?: boolean } = {}): boolean {
  const before = new Set(Object.keys(documentStore.getState().doc.levels))
  const made = runEdit(() =>
    documentStore.getState().apply(addLevel, { name, ...(options.below ? { below: true } : {}) }),
  )
  if (!made) return false

  const fresh = Object.keys(documentStore.getState().doc.levels).find((id) => !before.has(id))
  if (fresh) documentStore.getState().setLevel(fresh)
  return true
}

export function renameStorey(level: string, name: string): boolean {
  const called = name.trim()
  const record = documentStore.getState().doc.levels[level]
  if (!called || !record || called === record.name) return true
  return runEdit(() => documentStore.getState().apply(updateLevel, { level, name: called }))
}

export function setStoreyHeight(level: string, height: number): boolean {
  return runEdit(() => documentStore.getState().apply(updateLevel, { level, height }))
}

export function removeStorey(level: string): boolean {
  const { doc } = documentStore.getState()
  const left = levelsOf(doc).filter((storey) => storey.id !== level)
  const gone = runEdit(() => documentStore.getState().apply(removeLevel, { level }))
  if (gone && left[0]) documentStore.getState().setLevel(left[0].id)
  return gone
}
