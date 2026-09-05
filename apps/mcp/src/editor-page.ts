import type { Clear, ExecResult, ShowResult, ViewRequest } from '@houseit/bridge/contract'
import { type BrowserContext, chromium, type Page } from 'playwright-core'

/** Where Chrome listens when it was started with `--remote-debugging-port=9222`. */
const DEFAULT_ENDPOINT = process.env.HOUSEIT_CDP ?? 'http://127.0.0.1:9222'

/**
 * The profile the plans live in.
 *
 * IndexedDB belongs to a Chrome profile, so this is where the plan is: the same
 * directory `scripts/chrome.sh` uses, which is what lets a headless run and a
 * window you can watch be two ways into one set of plans rather than two sets.
 * Chrome will not open one profile twice, and it does not have to — either the
 * window is up, in which case we go in through its debugging port, or it is
 * not, in which case there is nobody to collide with.
 */
const PROFILE =
  process.env.HOUSEIT_CHROME_PROFILE ?? `${process.env.TMPDIR ?? '/tmp'}/houseit-chrome`

/** Big enough that a plan framed in it is worth looking at. */
const VIEWPORT = { width: 1440, height: 900 }

/**
 * Chrome renders WebGL in software when it is headless, and will not do it at
 * all unless it is told to. Without these the canvas comes back blank, which
 * looks exactly like a plan with nothing in it.
 */
const HEADLESS_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

/** The browser this process started, which is the only one it may close. */
let owned: BrowserContext | undefined

/**
 * The tab running the editor.
 *
 * A window already open on the debugging port is used as it is — that is the
 * one somebody is watching, and driving it is how the agent and the person see
 * the same plan. With no such window, one is started headless on the same
 * profile, so an agent on its own needs nothing but the dev server.
 *
 * The tab is found by asking each one whether it has the bridge installed
 * rather than by matching on URL: the editor is served from a dev server during
 * development and from a file during use, and neither is a reliable name.
 */
export async function connectToEditor(endpoint = DEFAULT_ENDPOINT): Promise<Page> {
  const running = await chromium.connectOverCDP(endpoint).catch(() => undefined)
  if (running) {
    for (const context of running.contexts()) {
      const found = await bridgedPage(context)
      if (found) return found
    }
    // Chrome is here but no tab has the editor in it: open one.
    const context = running.contexts()[0]
    const opened = context ? await editorTab(context) : undefined
    if (opened) return opened
    throw new Error(NOT_FOUND)
  }

  const context = await launchHeadless()
  const opened = (await bridgedPage(context)) ?? (await editorTab(context))
  if (opened) return opened
  await closeEditor()
  throw new Error(NOT_FOUND)
}

/**
 * Writes the plan back and closes the browser, if this process is the one that
 * started it. A window somebody is watching is left alone.
 *
 * The writing back matters: the plan is held for a quarter second after it
 * stops changing, and a browser closed inside that quarter second takes the
 * last command with it — which looks exactly like a command that did nothing.
 */
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

/** A tab in this context with the editor's bridge installed, if there is one. */
async function bridgedPage(context: BrowserContext): Promise<Page | undefined> {
  for (const page of context.pages()) {
    const installed = await page
      .evaluate("typeof window.floorplan?.exec === 'function'")
      .catch(() => false)
    if (installed === true) return page
  }
  return undefined
}

/**
 * Waits for the plan to have been drawn at least once.
 *
 * The bridge is installed before React renders, so a tab that answers commands
 * may not have a canvas yet — and a picture taken then is a picture of a strip
 * of nothing, which is what a headless run produced until this was here.
 */
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

/** A fresh tab on the editor, waited on until its bridge is up. */
async function editorTab(context: BrowserContext): Promise<Page | undefined> {
  const page = context.pages().find((it) => it.url() === 'about:blank') ?? (await context.newPage())
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

/** Where the editor is served from, when a tab has to be opened for it. */
const EDITOR_URL = process.env.HOUSEIT_URL ?? 'http://localhost:5173'

/**
 * Puts the tab in a project, making one of that name if there is none, and says
 * which it landed in.
 *
 * A plan is worked on at an address of its own, so this is a navigation and not
 * a command: the bridge settles which project it is, and the tab is then sent
 * there the way a click would send it.
 */
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
  return page.evaluate((script) => window.floorplan.exec(script), source)
}

export function showOnPage(page: Page, view: ViewRequest): Promise<ShowResult> {
  return page.evaluate((asked) => window.floorplan.show(asked), view)
}

/** Where on the canvas to look, read once the framing and the folding have landed. */
function clearOnPage(page: Page): Promise<Clear> {
  return page.evaluate(() => window.floorplan.clear())
}

/**
 * How long the tab gets to frame what it was asked to show before the picture
 * is taken: the framing lands on the next paint, and the labels follow it.
 */
const SETTLE_MS = 400

/** What a picture is: the bytes and what to call them. */
export const PICTURE_TYPE = 'image/jpeg'

/**
 * A picture of the plan as the tab shows it now: the part of the canvas the
 * framing landed in, without the panel and the cards floating over the rest.
 *
 * Taken at CSS size rather than device pixels, and as JPEG: a drawing of lines
 * and labels over photographed floors reads fine that way, at a tenth of the
 * bytes a retina PNG of the same view comes to — and every byte of it is
 * handed to the agent in the answer.
 */
export async function pictureOf(page: Page): Promise<Buffer> {
  // A tab behind another is not painted, and a picture of it is a picture of nothing.
  await page.bringToFront().catch(() => undefined)
  await waitForCanvas(page).catch(() => undefined)
  await page.waitForTimeout(SETTLE_MS)
  const canvas = page.locator('canvas').first()
  // Only now, with the panel folded and the framing landed, is it worth asking
  // what is still in the way.
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
