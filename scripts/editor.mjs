/**
 * A tab with the editor in it, for the scripts that drive one.
 *
 * The same way in as the CLI has: a Chrome already on the debugging port is
 * used, and with none there one is started headless on the same profile. So a
 * script needs nothing but `bun run dev`, and nothing pops up in front of you
 * while it works.
 */
import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/mcp/', import.meta.url))
const { chromium } = require('playwright-core')

export const EDITOR = (process.env.HOUSEIT_EDITOR_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const PORT = process.env.HOUSEIT_CDP_PORT ?? '9222'
const PROFILE =
  process.env.HOUSEIT_CHROME_PROFILE ?? `${process.env.TMPDIR ?? '/tmp'}/houseit-chrome`

/** Chrome renders WebGL in software when headless, and only if it is told to. */
const HEADLESS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

/**
 * Opens the editor and gives back the page and the way to let it go again.
 *
 * `close` writes the plan back before it shuts anything this script started —
 * the plan is held a quarter second after it stops changing, and a browser
 * closed inside that quarter second takes the last command with it.
 */
export async function openEditor({ viewport = { width: 1440, height: 900 } } = {}) {
  const running = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch(() => undefined)
  if (running) {
    const page = await bridged(running.contexts().flatMap((context) => context.pages()))
    if (page) {
      await noCache(page)
      return { page, close: async () => browserGoes(running) }
    }
    const context = running.contexts()[0]
    if (context) {
      const opened = await context.newPage()
      await noCache(opened)
      return { page: opened, close: async () => browserGoes(running) }
    }
  }

  const context = await launch(viewport)
  const page = (await bridged(context.pages())) ?? context.pages()[0] ?? (await context.newPage())
  await noCache(page)
  return {
    page,
    close: async () => {
      await page.evaluate(() => window.floorplan?.save()).catch(() => undefined)
      await context.close().catch(() => undefined)
    },
  }
}

/**
 * The profile, opened — and opened again with the lock cleared if the last
 * Chrome on it was killed rather than closed.
 *
 * Chrome leaves a `SingletonLock` behind when it dies hard, and every run after
 * that aborts rather than risk two browsers on one profile. Nothing was
 * answering on the debugging port a moment ago, so there is no such browser:
 * the lock is a leftover, and a leftover lock must not cost anybody an
 * afternoon.
 */
async function launch(viewport) {
  const open = () =>
    chromium.launchPersistentContext(PROFILE, {
      headless: true,
      channel: 'chrome',
      args: HEADLESS,
      viewport,
    })
  try {
    return await open()
  } catch (error) {
    if (!/ProcessSingleton/.test(String(error))) throw error
    for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      rmSync(`${PROFILE}/${name}`, { force: true })
    }
    return await open()
  }
}

/** Only what this script started is closed; a window somebody is watching is left alone. */
const browserGoes = (browser) => browser.close().catch(() => undefined)

/**
 * No HTTP cache, ever.
 *
 * The profile is persistent, so its cache outlives the run: a page opened again
 * comes back with the bundle it had last time, and a change to the editor is
 * simply not there. Two long hunts for a bug that was only a stale module
 * bought this line.
 */
async function noCache(page) {
  const session = await page.context().newCDPSession(page)
  await session.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => undefined)
}

async function bridged(pages) {
  for (const page of pages) {
    const has = await page
      .evaluate(() => typeof window.floorplan?.exec === 'function')
      .catch(() => false)
    if (has) return page
  }
  return undefined
}
