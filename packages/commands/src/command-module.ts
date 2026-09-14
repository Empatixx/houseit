import type { Discipline } from '@houseit/core/document'
import type { AnyCommand } from './define-command'

export type CommandModule = {
  discipline: Discipline
  commands: readonly AnyCommand[]
}

export function commandRegistry(
  modules: readonly CommandModule[],
  shared: readonly AnyCommand[] = [],
): ReadonlyMap<string, AnyCommand> {
  const commands = new Map<string, AnyCommand>()
  for (const command of [...shared, ...modules.flatMap((module) => module.commands)]) {
    if (commands.has(command.name)) throw new Error(`Duplicate command: ${command.name}`)
    commands.set(command.name, command)
  }
  return commands
}
