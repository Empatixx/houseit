#!/usr/bin/env node
import { connectToEditor, execOnPage, readPlan } from './editor-page'
import { report, toolDescription } from './report'

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

  const page = await connectToEditor()

  if (argv[0] === 'get-plan') {
    process.stdout.write(`${JSON.stringify(await readPlan(page), null, 2)}\n`)
    return 0
  }

  const result = await execOnPage(page, argv.join(' '))
  process.stdout.write(`${report(result)}\n`)
  return result.ok ? 0 : 1
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  },
)
