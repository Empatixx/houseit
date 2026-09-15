import type { Clear, ExecResult, ShowResult, ViewRequest } from '@houseit/bridge/contract'
import { type BrowserContext, chromium, type Page } from 'playwright-core'

const DEFAULT_ENDPOINT = process.env.HOUSEIT_CDP ?? 'http://127.0.0.1:9222'

const PROFILE =
  process.env.HOUSEIT_CHROME_PROFILE ?? `${process.env.TMPDIR ?? '/tmp'}/houseit-chrome`

const VIEWPORT = { width: 1440, height: 900 }

const HEADLESS_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

let owned: BrowserContext | undefined

export async function connectToEditor(endpoint = DEFAULT_ENDPOINT): Promise<Page> {
  const running = await chromium.connectOverCDP(endpoint).catch(() => undefined)
  if (running) {
    for (const context of running.contexts()) {
      const found = await bridgedPage(context)
      if (found) {
        await noCache(found)
        return found
      }
    }
    const context = running.contexts()[0]
    const opened = context ? await editorTab(context) : undefined
    if (opened) return opened
    throw new Error(NOT_FOUND)
  }

  const context = await launchHeadless()
  const opened = (await bridgedPage(context)) ?? (await editorTab(context))
  if (opened) {
    await noCache(opened)
    return opened
  }
  await closeEditor()
  throw new Error(NOT_FOUND)
}

export async function closeEditor(): Promise<void> {
  if (!owned) return
  const context = owned
  owned = undefined
  const page = context.pages()[0]
  await page?.evaluate(() => window.floorplan?.save()).catch(() => undefined)
  await context.close().catch(() => undefined)
}

async function launchHeadless(): Promise<BrowserContext> {
  if (owned) return owned
  try {
    owned = await chromium.launchPersistentContext(PROFILE, {
      headless: process.env.HOUSEIT_HEADED === undefined,
      channel: 'chrome',
      args: HEADLESS_ARGS,
      viewport: VIEWPORT,
    })
  } catch (error) {
    throw new Error(`${NOT_FOUND}\n\nStarting one instead failed: ${(error as Error).message}`)
  }
  return owned
}

async function noCache(page: Page): Promise<void> {
  const session = await page.context().newCDPSession(page)
  await session.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => undefined)
}

async function bridgedPage(context: BrowserContext): Promise<Page | undefined> {
  for (const page of context.pages()) {
    const installed = await page
      .evaluate("typeof window.floorplan?.exec === 'function'")
      .catch(() => false)
    if (installed === true) return page
  }
  return undefined
}

function waitForCanvas(page: Page): Promise<unknown> {
  return page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas')
      return canvas !== null && canvas.clientWidth > 0 && canvas.clientHeight > 0
    },
    undefined,
    { timeout: 15_000 },
  )
}

async function editorTab(context: BrowserContext): Promise<Page | undefined> {
  const page = context.pages().find((it) => it.url() === 'about:blank') ?? (await context.newPage())
  await noCache(page)
  await page.goto(EDITOR_URL).catch(() => undefined)
  const ready = await page
    .waitForFunction("typeof window.floorplan?.exec === 'function'", undefined, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  if (ready) {
    await waitForCanvas(page).catch(() => undefined)
    return page
  }
  if (context.pages().length > 1) await page.close().catch(() => undefined)
  return undefined
}

const NOT_FOUND = [
  'No houseit tab, and none could be started.',
  '',
  'The editor has to be running: `bun run dev`, then either',
  '',
  '  scripts/chrome.sh          a window you can watch, on a debugging port',
  '',
  'or nothing at all — a headless Chrome is started on the same profile.',
].join('\n')

const EDITOR_URL = process.env.HOUSEIT_URL ?? 'http://localhost:5173'

export async function openProject(page: Page, name: string): Promise<string> {
  const project = await page.evaluate((asked) => window.floorplan.ensureProject(asked), name)
  const already = await page
    .evaluate(() => window.floorplan.getPlan().project?.id)
    .catch(() => undefined)
  if (already === project.id) return project.id

  await page.goto(`${EDITOR_URL}/p/${project.id}`)
  await page.waitForFunction((id) => window.floorplan?.getPlan().project?.id === id, project.id, {
    timeout: 15_000,
  })
  await waitForCanvas(page).catch(() => undefined)
  return project.id
}

export function execOnPage(page: Page, source: string): Promise<ExecResult> {
  return page.evaluate(async (script) => {
    const result = window.floorplan.exec(script)
    if (!result.ok) return result
    try {
      await window.floorplan.save()
      return result
    } catch (error) {
      return {
        ok: false as const,
        error: `The edit was applied, but saving the native model failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }, source)
}

export function showOnPage(page: Page, view: ViewRequest): Promise<ShowResult> {
  return page.evaluate((asked) => window.floorplan.show(asked), view)
}

function clearOnPage(page: Page): Promise<Clear> {
  return page.evaluate(() => window.floorplan.clear())
}

const SETTLE_MS = 400

export const PICTURE_TYPE = 'image/jpeg'

export async function pictureOf(page: Page): Promise<Buffer> {
  await page.bringToFront().catch(() => undefined)
  await waitForCanvas(page).catch(() => undefined)
  await page.waitForTimeout(SETTLE_MS)
  await page.waitForFunction(() => {
    const state = document.querySelector('canvas')?.dataset.houseitRender
    if (state === 'error') throw new Error('The native wall renderer failed')
    return state !== 'pending'
  })
  const canvas = page.locator('canvas').first()
  const clear = await clearOnPage(page).catch(() => undefined)
  const box = clear ? await canvas.boundingBox() : null
  if (!clear || !box) return canvas.screenshot({ type: 'jpeg', quality: 85, scale: 'css' })
  return page.screenshot({
    type: 'jpeg',
    quality: 85,
    scale: 'css',
    clip: { x: box.x + clear.x, y: box.y + clear.y, width: clear.width, height: clear.height },
  })
}
