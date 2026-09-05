#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import {
  closeEditor,
  connectToEditor,
  execOnPage,
  openProject,
  pictureOf,
  showOnPage,
} from './editor-page'
import { helpText, report, toolDescription } from './report'
import { scriptOf } from './script-of'
import { viewOf } from './view-of'

/**
 * The same registry the MCP tool uses, reached from a terminal. Useful without an
 * agent, and it keeps the bridge honest — anything the agent can do is reachable
 * here, against the same live tab. One command as arguments, a whole script as
 * one argument or on standard input (`-`): the words are the same either way.
 */
const USAGE = [
  'Usage:',
  '  houseit <command> [--option value …]      one command, its words as arguments',
  "  houseit '<script>'                          a script as written, lines and quotes and all",
  '  houseit - < script.txt                     the same from standard input',
  '  houseit --picture out.jpg get-plan         with a picture of what it answered about',
  '  houseit --project byt-praha get-plan       in that plan, made if there is none yet',
].join('\n')

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === 'help') {
    process.stdout.write(`${USAGE}\n\n${toolDescription()}\n\nCommands:\n\n${helpText()}\n`)
    return 0
  }

  // Taken off the front, before the command begins: these say where the command
  // runs and what to do with what it shows, and neither is part of the command.
  let picture: string | undefined
  let project: string | undefined
  while (argv[0] === '--picture' || argv[0] === '--project') {
    const value = argv[1]
    if (!value) throw new Error(`${argv[0]} needs a value`)
    if (argv[0] === '--picture') picture = value
    else project = value
    argv = argv.slice(2)
  }

  const page = await connectToEditor()
  if (project !== undefined) await openProject(page, project)

  // One command's words back into a line, or a script handed over as written.
  const source = argv[0] === '-' ? readFileSync(0, 'utf8') : scriptOf(argv)
  const result = await execOnPage(page, source)
  process.stdout.write(`${report(result)}\n`)

  if (result.ok && picture) {
    const shown = await showOnPage(page, viewOf(result.answer))
    if (!shown.ok) throw new Error(shown.error)
    writeFileSync(picture, await pictureOf(page))
    process.stderr.write(`picture written to ${picture}\n`)
  }
  return result.ok ? 0 : 1
}

// The plan is written back and a browser this process started is closed, either
// way — a failure half way through a script still leaves the plan as it stands.
main(process.argv.slice(2))
  .then(
    (code) => code,
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    },
  )
  .then(async (code) => {
    await closeEditor()
    process.exit(code)
  })
