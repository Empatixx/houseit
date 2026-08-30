/** Anything the caller got wrong: unknown command, bad option, invalid value. */
export class CommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommandError'
  }
}
