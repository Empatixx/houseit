#!/usr/bin/env node
/**
 * Empties the plan in the editor tab: what was drawn is forgotten and the
 * editor is reloaded on a blank floor, ready for `floor-shape`. For starting
 * a plan over from an agent's shell, where nothing else can reach the tab.
 *
 *   scripts/chrome.sh           # a Chrome with a debugging port, once
 *   node scripts/reset-plan.mjs
 */
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/mcp/', import.meta.url))
const { chromium } = require('playwright-core')

const STORAGE_KEY = 'houseit.document'
const EDITOR = process.env.HOUSEIT_EDITOR_URL ?? 'http://localhost:5173/'

const port = process.env.HOUSEIT_CDP_PORT ?? '9222'
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
const pages = browser.contexts().flatMap((context) => context.pages())
const page =
  pages.find((candidate) => candidate.url().startsWith(EDITOR)) ??
  (await browser.contexts()[0].newPage())

await page.goto(EDITOR)
await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)
await page.goto(EDITOR)
await page.waitForFunction(() => typeof window.floorplan?.exec === 'function')
const answer = await page.evaluate(() => window.floorplan.exec('describe'))
const rooms = answer.ok ? (answer.output[0]?.rooms?.length ?? 0) : -1
console.log(rooms === 0 ? 'The plan is empty.' : `Not empty: ${JSON.stringify(answer).slice(0, 200)}`)
await browser.close().catch(() => {})
