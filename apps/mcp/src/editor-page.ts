import type { ExecResult, PlanSnapshot } from '@houseit/bridge/contract'
import { chromium, type Page } from 'playwright-core'

/** Where Chrome listens when started with `--remote-debugging-port=9222`. */
const DEFAULT_ENDPOINT = process.env.HOUSEIT_CDP ?? 'http://127.0.0.1:9222'

const NOT_FOUND = [
  'No houseit tab found.',
  '',
  'Start Chrome with remote debugging and open the editor:',
  '',
  '  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\',
  '    --remote-debugging-port=9222 http://localhost:5173',
  '',
  'The editor must be running (`bun run dev`) and the tab left open.',
].join('\n')

/**
 * Finds the tab running the editor by asking each one whether it has the bridge
 * installed, rather than matching on URL — the editor is served from a dev server
 * during development and from a file during use, and neither is a reliable name.
 */
export async function connectToEditor(endpoint = DEFAULT_ENDPOINT): Promise<Page> {
  const browser = await chromium.connectOverCDP(endpoint)

  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      const installed = await page
        .evaluate("typeof window.floorplan?.exec === 'function'")
        .catch(() => false)
      if (installed === true) return page
    }
  }

  // No tab has the editor in it, but Chrome is here: open one. The agent then
  // needs nothing beyond a running dev server and a Chrome it can reach.
  const context = browser.contexts()[0]
  if (context) {
    const page = await context.newPage()
    await page.goto(EDITOR_URL).catch(() => undefined)
    const ready = await page
      .waitForFunction("typeof window.floorplan?.exec === 'function'", undefined, {
        timeout: 10_000,
      })
      .then(() => true)
      .catch(() => false)
    if (ready) return page
    await page.close().catch(() => undefined)
  }

  throw new Error(NOT_FOUND)
}

/** Where the editor is served from, when a tab has to be opened for it. */
const EDITOR_URL = process.env.HOUSEIT_URL ?? 'http://localhost:5173'

export function execOnPage(page: Page, source: string): Promise<ExecResult> {
  return page.evaluate((script) => window.floorplan.exec(script), source)
}

export function readPlan(page: Page): Promise<PlanSnapshot> {
  return page.evaluate(() => window.floorplan.getPlan())
}
