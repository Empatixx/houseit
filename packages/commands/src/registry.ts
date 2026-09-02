import { addDoor } from './add-door'
import { addObject } from './add-object'
import { addRoom } from './add-room'
import { addWindow } from './add-window'
import type { Command } from './define-command'
import { describe } from './describe'
import { floorShape } from './floor-shape'
import { measure } from './measure'
import { moveObject } from './move-object'
import { removeDoor, removeObject, removeWindow } from './remove'
import { setFloor } from './set-floor'
import { turnObject } from './turn-object'

const ALL: Command[] = [
  floorShape,
  addRoom,
  addWindow,
  addDoor,
  setFloor,
  addObject,
  moveObject,
  turnObject,
  removeObject,
  removeWindow,
  removeDoor,
  describe,
  measure,
]

export const REGISTRY: ReadonlyMap<string, Command> = new Map(ALL.map((c) => [c.name, c]))

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
