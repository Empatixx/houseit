import { addDoor } from './add-door'
import { addObject } from './add-object'
import { addRoom } from './add-room'
import { addWindow } from './add-window'
import { checkPlan } from './check-plan'
import type { AnyCommand } from './define-command'
import { describe } from './describe'
import { floorShape } from './floor-shape'
import { measure } from './measure'
import { moveObject } from './move-object'
import { moveDoor, moveWindow } from './move-opening'
import { removeDoor, removeObject, removeWindow } from './remove'
import { renameRoom } from './rename-room'
import { resizeObject } from './resize-object'
import { setFloor } from './set-floor'
import { setDoor, setWindow } from './set-opening'
import { setRoomKind } from './set-room-kind'
import { setSurface } from './set-surface'
import { turnObject } from './turn-object'

const ALL: AnyCommand[] = [
  floorShape,
  addRoom,
  addWindow,
  addDoor,
  moveWindow,
  moveDoor,
  setFloor,
  renameRoom,
  setRoomKind,
  setDoor,
  setWindow,
  addObject,
  moveObject,
  turnObject,
  resizeObject,
  setSurface,
  removeObject,
  removeWindow,
  removeDoor,
  describe,
  measure,
  checkPlan,
]

export const REGISTRY: ReadonlyMap<string, AnyCommand> = new Map(ALL.map((c) => [c.name, c]))

/** Help text for humans at a terminal and for the agent reading the MCP tool. */
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
