import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/mcp/', import.meta.url))
const { chromium } = require('playwright-core')

export const EDITOR = (process.env.HOUSEIT_EDITOR_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const PORT = process.env.HOUSEIT_CDP_PORT ?? '9222'
const PROFILE =
  process.env.HOUSEIT_CHROME_PROFILE ?? `${process.env.TMPDIR ?? '/tmp'}/houseit-chrome`

const HEADLESS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

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

const browserGoes = (browser) => browser.close().catch(() => undefined)

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
