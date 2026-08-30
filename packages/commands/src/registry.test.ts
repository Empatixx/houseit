import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { describeCommands, REGISTRY } from './registry'
import { runScript } from './run'

/**
 * The agent only ever sees the command line. Anything it cannot reach from a
 * command string might as well not exist, so what is registered, what is
 * described and what actually runs all have to agree.
 */
test('every command is described, with every option it takes', () => {
  const help = describeCommands()

  for (const command of REGISTRY.values()) {
    expect(help, command.name).toContain(command.name)
    for (const option of command.options) {
      expect(help, `${command.name} --${option.flag}`).toContain(`--${option.flag}`)
    }
  }
})

test('every command is reachable by the name it is described under', () => {
  for (const command of REGISTRY.values()) {
    // Run it with nothing: whatever comes back must not be "no such command".
    const failed = attempt(command.name)
    expect(failed, command.name).not.toMatch(/unknown command/i)
  }
})

test('a name nobody registered is refused rather than ignored', () => {
  expect(attempt('add-swimming-pool')).toMatch(/unknown command/i)
})

test('every option is spelled the way a person would type it', () => {
  for (const command of REGISTRY.values()) {
    for (const option of command.options) {
      expect(option.flag, `${command.name}.${option.name}`).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  }
})

function attempt(source: string): string {
  try {
    runScript(createEmptyDocument(), source)
    return ''
  } catch (error) {
    return (error as Error).message
  }
}
