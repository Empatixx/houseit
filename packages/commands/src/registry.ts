import { addLevel, removeLevel, updateLevel } from './add-level'
import { addObject } from './add-object'
import { addOpening } from './add-opening'
import { addRoom } from './add-room'
import { addSite } from './add-site'
import type { AnyCommand } from './define-command'
import { getPlan } from './get-plan'
import { removeObject, removeOpening } from './remove'
import { removeRoom } from './remove-room'
import { removeSite } from './remove-site'
import { updateObject } from './update-object'
import { updateOpening } from './update-opening'
import { updateRoom } from './update-room'
import { updateSite } from './update-site'

const ALL: AnyCommand[] = [
  getPlan,
  addLevel,
  updateLevel,
  removeLevel,
  addRoom,
  updateRoom,
  removeRoom,
  addOpening,
  updateOpening,
  removeOpening,
  addObject,
  updateObject,
  removeObject,
  addSite,
  updateSite,
  removeSite,
]

export const REGISTRY: ReadonlyMap<string, AnyCommand> = new Map(ALL.map((c) => [c.name, c]))

export function describeCommands(): string {
  return ALL.map((command) => {
    const options = command.options
      .map((option) => {
        const flag = option.kind === 'boolean' ? `--${option.flag}` : `--${option.flag} <value>`
        return option.required ? flag : `[${flag}]`
      })
      .join(' ')
    return `${command.name} ${options}\n    ${command.summary}`
  }).join('\n\n')
}
