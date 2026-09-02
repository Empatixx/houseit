#!/usr/bin/env node
/**
 * Puts one object alone in a room of its own and takes its picture.
 *
 * Furniture is tuned by looking at it, and looking at it in a furnished plan does
 * not work: the thing is forty pixels across, half under a rug, and every guess
 * about what is wrong with it is a guess. So this builds a throwaway plan through
 * the very same CLI the agent has — a room barely bigger than the object, nothing
 * else in it — frames it, and saves a picture big enough to see what is actually
 * drawn.
 *
 * The plan you were working on is put back afterwards, whatever happens.
 *
 *   node scripts/look.mjs --type media-unit --surface walnut --out /tmp/tv.png
 *   node scripts/look.mjs --type sofa-3 --surface grey --against north
 */
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/mcp/', import.meta.url))
const { chromium } = require('playwright-core')

const STORAGE_KEY = 'houseit.document'
/** Floor left round the object, so it is framed and not cropped. */
const MARGIN = 700
/** Options handed straight on to `add-object`. */
const PASSED = ['surface', 'against', 'width', 'depth', 'seats']

const args = parse(process.argv.slice(2))
if (!args.type) {
  console.error('usage: node scripts/look.mjs --type <object type> [--surface s] [--out file.png]')
  process.exit(1)
}

const port = process.env.HOUSEIT_CDP_PORT ?? '9222'
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
const page = await editorPage(browser)
if (!page) {
  console.error(`no editor page on port ${port} — run bun run dev and scripts/chrome.sh`)
  process.exit(1)
}

const kept = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
try {
  // A generous room first, only to be told how big the thing turns out to be, then
  // the same thing again in a room cut to fit it. The size comes from the plan
  // rather than from the catalogue, so --width and --depth are accounted for too.
  const measured = await build(page, 20_000, 20_000, args)
  const room = {
    width: measured.width + MARGIN * 2,
    depth: measured.depth + MARGIN * 2,
  }
  await build(page, room.width, room.depth, args)

  await page.getByText('Fit', { exact: true }).click()
  await page.waitForTimeout(2500)
  const out = args.out ?? `${args.type}.png`
  await page.screenshot({ path: out })
  console.log(`${args.type}: ${measured.width} by ${measured.depth} mm — ${out}`)
} finally {
  await page.evaluate(
    ([key, value]) => (value ? localStorage.setItem(key, value) : localStorage.removeItem(key)),
    [STORAGE_KEY, kept],
  )
  await page.reload()
  await browser.close()
}

/** Wipes the plan and draws a room with the one thing in it, through the CLI. */
async function build(page, width, depth, args) {
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)
  await page.reload()
  await page.waitForFunction(() => typeof window.floorplan?.exec === 'function')
  await page.bringToFront()
  await page.waitForTimeout(1500)

  const script = [
    `floor-shape --material tile-white --kind rectangle --width ${Math.round(width)} --depth ${Math.round(depth)} --name look`,
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

async function editorPage(browser) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      const has = await page
        .evaluate(() => typeof window.floorplan?.exec === 'function')
        .catch(() => false)
      if (has) return page
    }
  }
  return undefined
}
