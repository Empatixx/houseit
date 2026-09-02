import type { ViewRequest } from '@houseit/bridge/contract'
import { parseArgv } from '@houseit/commands/parse-argv'
import { REGISTRY } from '@houseit/commands/registry'
import { scriptLines } from '@houseit/commands/script-lines'

/** The commands that look rather than change, and so are worth a picture. */
const LOOKS = new Set(['describe', 'measure', 'check-plan'])

/**
 * What the last look in a script was at, if it had one: the room, the thing in
 * it, or the level, read from the same options the command itself read. That is
 * what the picture taken after the script has run should be of — an answer
 * about the kitchen comes with the kitchen in front of the camera.
 */
export function viewOf(source: string): ViewRequest | undefined {
  let view: ViewRequest | undefined
  let lines: string[][]
  try {
    lines = scriptLines(source)
  } catch {
    return undefined
  }

  for (const [name, ...argv] of lines) {
    if (name === undefined || !LOOKS.has(name)) continue
    const command = REGISTRY.get(name)
    if (!command) continue
    try {
      const values = parseArgv(name, command.options, argv)
      view = {
        ...(typeof values.room === 'string' ? { room: values.room } : {}),
        ...(typeof values.type === 'string' ? { type: values.type } : {}),
        dimensions: name === 'measure',
      }
    } catch {
      // The command itself refused the line; there is nothing to look at.
    }
  }
  return view
}
