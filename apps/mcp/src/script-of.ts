import { quoted } from '@houseit/commands/command-line'

export function scriptOf(argv: string[]): string {
  if (argv.length === 1 && /\s/.test(argv[0]!)) return argv[0]!
  return argv.map(quoted).join(' ')
}
