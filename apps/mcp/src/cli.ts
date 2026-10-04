#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import {
  closeEditor,
  connectToEditor,
  execOnPage,
  houseOf,
  openProject,
  pictureOf,
  showOnPage,
} from './editor-page'
import { guidelinesText, helpText, report, toolDescription } from './report'
import { scriptOf } from './script-of'
import { viewOf } from './view-of'

const USAGE = [
  'Usage:',
  '  houseit <command> [--option value …]      one command, its words as arguments',
  "  houseit '<script>'                          a script as written, lines and quotes and all",
  '  houseit - < script.txt                     the same from standard input',
  '  houseit --picture out.jpg get-plan         with a picture of what it answered about',
  '  houseit --project byt-praha get-plan       in that plan, made if there is none yet',
  '  houseit --export house.glb get-plan       with the whole house as a glTF model',
  '  houseit guidelines                         how a flat or a house goes together',
].join('\n')

async function main(argv: string[]): Promise<number> {
  if (argv[0] === 'guidelines') {
    process.stdout.write(`${guidelinesText()}\n`)
    return 0
  }
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === 'help') {
    process.stdout.write(`${USAGE}\n\n${toolDescription()}\n\nCommands:\n\n${helpText()}\n`)
    return 0
  }

  let picture: string | undefined
  let project: string | undefined
  let model: string | undefined
  while (argv[0] === '--picture' || argv[0] === '--project' || argv[0] === '--export') {
    const value = argv[1]
    if (!value) throw new Error(`${argv[0]} needs a value`)
    if (argv[0] === '--picture') picture = value
    else if (argv[0] === '--export') model = value
    else project = value
    argv = argv.slice(2)
  }

  const page = await connectToEditor()
  if (project !== undefined) await openProject(page, project)

  const source = argv[0] === '-' ? readFileSync(0, 'utf8') : scriptOf(argv)
  const result = await execOnPage(page, source)
  process.stdout.write(`${report(result)}\n`)

  if (result.ok && picture) {
    const shown = await showOnPage(page, viewOf(result.answer))
    if (!shown.ok) throw new Error(shown.error)
    writeFileSync(picture, await pictureOf(page))
    process.stderr.write(`picture written to ${picture}\n`)
  }
  if (result.ok && model) {
    writeFileSync(model, await houseOf(page))
    process.stderr.write(`house written to ${model}\n`)
  }
  return result.ok ? 0 : 1
}

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
