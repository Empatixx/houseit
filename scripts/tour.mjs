import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { EDITOR, openEditor } from './editor.mjs'

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    out: { type: 'string', default: '/tmp/tour' },
    video: { type: 'boolean', default: false },
  },
})

mkdirSync(values.out, { recursive: true })
const { page, close } = await openEditor()

try {
  if (values.project && !page.url().endsWith(`/p/${values.project}`)) {
    await page.goto(`${EDITOR}/p/${values.project}`)
  }
  await page.waitForFunction(() => window.__houseit?.tourStore, null, { timeout: 60_000 })
  await page.evaluate(() => {
    window.__houseit.walkStore.getState().inspect(null)
    window.__houseit.modeStore.getState().setMode('3d')
  })
  await page.waitForFunction(() => window.__houseit.walkStore.getState().walker, null, {
    timeout: 60_000,
  })
  await page
    .waitForFunction(() => window.__houseit.walkStore.getState().fov !== 90, null, {
      timeout: 15_000,
    })
    .catch(() => undefined)
  await page.waitForTimeout(4000)

  const shots = await page.evaluate(() => {
    const { documentStore, walkStore, tourOf } = window.__houseit
    const { doc, level } = documentStore.getState()
    return tourOf(doc, walkStore.getState().fov, level)
  })
  writeFileSync(join(values.out, 'shots.json'), JSON.stringify(shots, null, 2))

  const canvas = page.locator('canvas').first()
  await canvas.evaluate((element) => {
    for (let node = element; node; node = node.parentElement) node.dataset.tour = ''
  })
  const bare = await page.addStyleTag({
    content: 'body *:not([data-tour]) { visibility: hidden !important }',
  })
  for (const [index, shot] of shots.entries()) {
    await page.evaluate(
      ([all, at]) => window.__houseit.tourStore.getState().hold(all, at),
      [shots, index],
    )
    await page.waitForTimeout(2500)
    const name = `${String(index + 1).padStart(2, '0')}-${shot.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`
    await canvas.screenshot({ path: join(values.out, name) })
    console.log(name)
  }
  await page.evaluate(() => window.__houseit.tourStore.getState().stop())
  await bare.evaluate((style) => style.remove())

  if (values.video) {
    await page.evaluate((all) => window.__houseit.tourStore.getState().play(all, true), shots)
    await page.waitForFunction(() => window.__houseit.tourStore.getState().film, null, {
      timeout: shots.length * 10_000 + 30_000,
      polling: 1000,
    })
    const film = await page.evaluate(async () => {
      const blob = window.__houseit.tourStore.getState().film
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let text = ''
      for (const byte of bytes) text += String.fromCharCode(byte)
      return btoa(text)
    })
    writeFileSync(join(values.out, 'tour.webm'), Buffer.from(film, 'base64'))
    console.log('tour.webm')
  }
} finally {
  await close()
}
