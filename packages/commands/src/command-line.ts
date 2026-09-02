/**
 * A command line, built rather than typed.
 *
 * The plan's own tokenizer reads a line the way a shell would, so a room called
 * "master bedroom" has to be quoted to arrive as one word. Anything that turns
 * a click or a drag into a command comes through here, and the terminal does
 * the same on its way in — one reading and one writing, kept in step.
 */

export type OptionValue = string | number | boolean | undefined

/** `add-door --room "master bedroom" --side south`, from a name and its options. */
export function commandLine(name: string, options: Record<string, OptionValue>): string {
  const parts = [name]
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === false) continue
    const flag = `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
    parts.push(value === true ? flag : `${flag} ${quoted(String(value))}`)
  }
  return parts.join(' ')
}

/** A token as the tokenizer will read it back: quoted only if it has to be. */
export const quoted = (token: string) =>
  /[\s"'\\]/.test(token) || token === '' ? `"${token.replace(/(["\\])/g, '\\$1')}"` : token
