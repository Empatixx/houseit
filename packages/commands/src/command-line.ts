/**
 * A word on a command line, the way the plan's own tokenizer will read it
 * back: quoted only if it has to be. The terminal hands its arguments over one
 * by one, and a room called "master bedroom" has to arrive as one word.
 */
export const quoted = (token: string) =>
  /[\s"'\\]/.test(token) || token === '' ? `"${token.replace(/(["\\])/g, '\\$1')}"` : token
