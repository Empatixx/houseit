import { commandRegistry } from './command-module'
import { COMMAND_MODULES } from './command-modules'
import { getPlan } from './get-plan'

export const REGISTRY = commandRegistry(COMMAND_MODULES, [getPlan])

export function describeCommands(): string {
  return [...REGISTRY.values()]
    .map((command) => {
      const options = command.options
        .map((option) => {
          const flag = option.kind === 'boolean' ? `--${option.flag}` : `--${option.flag} <value>`
          return option.required ? flag : `[${flag}]`
        })
        .join(' ')
      return `${command.name} ${options}\n    ${command.summary}`
    })
    .join('\n\n')
}
