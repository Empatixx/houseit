#!/usr/bin/env node
/**
 * Empties the plan of the project open in the editor tab: what was drawn is
 * forgotten and the editor comes back on a blank floor, ready for `floor-shape`.
 * For starting a plan over from an agent's shell, where nothing else can reach
 * the tab.
 *
 * The project is made again under its own name rather than the document being
 * written to behind the commands' back — which is also why its address does not
 * change.
 *
 *   scripts/chrome.sh           # a Chrome with a debugging port, once
 *   node scripts/reset-plan.mjs
 */
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/mcp/', import.meta.url))
const { chromium } = require('playwright-core')

const EDITOR = (process.env.HOUSEIT_EDITOR_URL ?? 'http://localhost:5173').replace(/\/$/, '')

const port = process.env.HOUSEIT_CDP_PORT ?? '9222'
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
const pages = browser.contexts().flatMap((context) => context.pages())
const page =
  pages.find((candidate) => candidate.url().startsWith(EDITOR)) ??
  (await browser.contexts()[0].newPage())

await page.waitForFunction(() => typeof window.__houseit?.projectsStore?.getState === 'function')
const open = await page.evaluate(() => window.__houseit.projectsStore.getState().open)

if (!open) {
  const ids = await page.evaluate(async () => {
    const projects = window.__houseit.projectsStore
    await projects.getState().refresh()
    return (projects.getState().list ?? []).map((project) => project.id)
  })
  console.log(
    ids.length > 0
      ? `No project open. Open one first: ${ids.map((id) => `${EDITOR}/p/${id}`).join(', ')}`
      : 'No project open, and none to open — make one on the home screen.',
  )
  await browser.close().catch(() => {})
  process.exit(1)
}

// Away and back under the same name, which gives back the same address.
await page.goto(EDITOR)
await page.evaluate(async (name) => {
  const projects = window.__houseit.projectsStore
  await projects.getState().remove(name.id)
  await projects.getState().create(name.name)
}, open)
await page.goto(`${EDITOR}/p/${open.id}`)
await page.waitForFunction(
  (id) => window.__houseit.projectsStore.getState().open?.id === id,
  open.id,
)

const answer = await page.evaluate(() => window.floorplan.exec('describe'))
const rooms = answer.ok ? (answer.output[0]?.rooms?.length ?? 0) : -1
console.log(
  rooms === 0 ? `${open.name} is empty.` : `Not empty: ${JSON.stringify(answer).slice(0, 200)}`,
)
await browser.close().catch(() => {})
