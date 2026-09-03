import { quoted } from '@houseit/commands/command-line'

/**
 * The script the terminal's arguments spell. Several arguments are one
 * command's words, each quoted back into a word if it has spaces in it — a
 * room called "master bedroom" arrives as one argument and has to stay one
 * word. One argument with spaces or lines in it is a script as written, with
 * its own quotes in it, and is handed over untouched.
 */
export function scriptOf(argv: string[]): string {
  if (argv.length === 1 && /\s/.test(argv[0]!)) return argv[0]!
  return argv.map(quoted).join(' ')
}
