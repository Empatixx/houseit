#!/usr/bin/env node
import { EDITOR, openEditor } from './editor.mjs'

const LOOK = 'look'
const MARGIN = 700
const PASSED = ['surface', 'against', 'width', 'depth', 'seats']

const args = parse(process.argv.slice(2))
if (!args.type) {
  console.error('usage: node scripts/look.mjs --type <object type> [--surface s] [--out file.png]')
  process.exit(1)
}

const { page, close } = await openEditor()

const kept = await page.evaluate(() => window.__houseit?.projectsStore.getState().open?.id ?? null)
try {
  const measured = await build(page, 20_000, 20_000, args)
  const room = {
    width: measured.width + MARGIN * 2,
    depth: measured.depth + MARGIN * 2,
  }
  await build(page, room.width, room.depth, args)

  await page.evaluate(() => window.floorplan.show({}))
  await page.waitForTimeout(2500)
  const out = args.out ?? `${args.type}.png`
  await page.screenshot({ path: out })
  console.log(`${args.type}: ${measured.width} by ${measured.depth} mm — ${out}`)
} finally {
  await page.goto(kept ? `${EDITOR}/p/${kept}` : EDITOR)
  await page.evaluate((id) => window.__houseit.projectsStore.getState().remove(id), LOOK)
  await close()
}

async function build(page, width, depth, args) {
  await page.goto(EDITOR)
  await page.waitForFunction(() => typeof window.__houseit?.projectsStore?.getState === 'function')
  const id = await page.evaluate(async (name) => {
    const projects = window.__houseit.projectsStore
    await projects.getState().refresh()
    await projects.getState().remove(name)
    return (await projects.getState().create(name)).id
  }, LOOK)

  await page.goto(`${EDITOR}/p/${id}`)
  await page.waitForFunction(
    (open) => window.__houseit?.projectsStore.getState().open?.id === open,
    id,
  )
  await page.bringToFront()
  await page.waitForTimeout(1200)

  const script = [
    `add-room --material tile-white --shape rectangle --width ${Math.round(width)} --depth ${Math.round(depth)} --name look`,
    ['add-object --room look', `--type ${args.type}`, ...flags(args)].join(' '),
  ].join('\n')

  const result = await page.evaluate((source) => window.floorplan.exec(source), script)
  if (!result.ok) throw new Error(result.error)

  const object = Object.values(result.document.objects)[0]
  if (!object) throw new Error(`nothing was placed for --type ${args.type}`)
  return object
}

function flags(args) {
  return PASSED.filter((name) => args[name] !== undefined).map((name) => `--${name} ${args[name]}`)
}

function parse(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.replace(/^--/, '')
    if (name) args[name] = argv[i + 1]
  }
  return args
}
