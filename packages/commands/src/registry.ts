import { addLevel, removeLevel, updateLevel } from './add-level'
import { addObject } from './add-object'
import { addOpening } from './add-opening'
import { addRoom } from './add-room'
import type { AnyCommand } from './define-command'
import { getPlan } from './get-plan'
import { removeObject, removeOpening } from './remove'
import { removeRoom } from './remove-room'
import { updateObject } from './update-object'
import { updateOpening } from './update-opening'
import { updateRoom } from './update-room'

/**
 * Everything an agent can say, which is four nouns and one question.
 *
 * A storey, a room, a hole in a wall, a thing in a room — each made, changed
 * and taken out again. There is no noun for a wall: every wall is the edge of a
 * room, and `add-room` draws the ones a room needs. There is no verb for
 * measuring or describing either: every command answers with the rooms it
 * touched and what is now wrong with the plan, so the reading is in the doing.
 *
 * `move-wall` is still a command, and is not here. The editor's wall drag calls
 * it with typed arguments and `update-room --by` calls it too — but an agent
 * that could move a wall on its own would have a second way of saying what
 * `update-room` says, and one of two ways is always the wrong one.
 */
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
]

export const REGISTRY: ReadonlyMap<string, AnyCommand> = new Map(ALL.map((c) => [c.name, c]))

/** Help text for humans at a terminal and for the agent that asks for it. */
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
