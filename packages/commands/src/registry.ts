import { addLevel, removeLevel, updateLevel } from './add-level'
import { addObject } from './add-object'
import { addOpening } from './add-opening'
import { addRoom } from './add-room'
import { addColumn, removeColumn, updateColumn } from './column'
import { addRamp, addShaft, removeRamp, removeShaft } from './connections'
import type { AnyCommand } from './define-command'
import { addDevice, removeDevice, updateDevice } from './device'
import { getPlan } from './get-plan'
import { removeObject, removeOpening } from './remove'
import { removeRoom } from './remove-room'
import { addStair, removeStair } from './stair-run'
import { updateObject } from './update-object'
import { updateOpening } from './update-opening'
import { updateRoom } from './update-room'
import { updateSite } from './update-site'

import { addWall, removeWall, updateWall } from './wall'

const ALL: AnyCommand[] = [
  getPlan,
  addDevice,
  updateDevice,
  removeDevice,
  addWall,
  updateWall,
  removeWall,
  updateSite,
  addStair,
  removeStair,
  addShaft,
  removeShaft,
  addRamp,
  removeRamp,
  addColumn,
  updateColumn,
  removeColumn,
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
