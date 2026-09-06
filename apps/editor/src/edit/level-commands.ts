import { addLevel, removeLevel, updateLevel } from '@houseit/commands/add-level'
import { levelsOf } from '@houseit/core/levels'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

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

export function moveStorey(level: string, storey: number): boolean {
  return runEdit(() => documentStore.getState().apply(updateLevel, { level, storey }))
}

export function removeStorey(level: string): boolean {
  const { doc } = documentStore.getState()
  const left = levelsOf(doc).filter((storey) => storey.id !== level)
  const gone = runEdit(() => documentStore.getState().apply(removeLevel, { level }))
  if (gone && left[0]) documentStore.getState().setLevel(left[0].id)
  return gone
}
