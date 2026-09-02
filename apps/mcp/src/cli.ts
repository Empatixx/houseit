#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { quoted } from '@houseit/commands/command-line'
import { connectToEditor, execOnPage, pictureOf, readPlan, showOnPage } from './editor-page'
import { report, toolDescription } from './report'
import { viewOf } from './view-of'

/**
 * The same registry the MCP tool uses, reached from a terminal. Useful without an
 * agent, and it keeps the bridge honest — anything the agent can do is reachable
 * here, against the same live tab.
 */
async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === 'help') {
    process.stdout.write(`${toolDescription()}\n`)
    return 0
  }

  // `houseit --picture out.jpg describe --room kitchen` saves what the agent
  // would have been shown. Taken off the front, before the command begins.
  let picture: string | undefined
  if (argv[0] === '--picture') {
    picture = argv[1]
    if (!picture) throw new Error('--picture needs a file to write to')
    argv = argv.slice(2)
  }

  const page = await connectToEditor()

  if (argv[0] === 'get-plan') {
    process.stdout.write(`${JSON.stringify(await readPlan(page), null, 2)}\n`)
    return 0
  }

  // Back into one line the way the shell had it: a room called "master bedroom"
  // arrives as one argument here and has to be one word in the script too.
  const source = argv.map(quoted).join(' ')
  const result = await execOnPage(page, source)
  process.stdout.write(`${report(result)}\n`)

  const view = result.ok && picture ? viewOf(source) : undefined
  if (view && picture) {
    const shown = await showOnPage(page, view)
    if (!shown.ok) throw new Error(shown.error)
    writeFileSync(picture, await pictureOf(page))
    process.stderr.write(`picture written to ${picture}\n`)
  }
  return result.ok ? 0 : 1
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  },
)
