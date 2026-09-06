#!/usr/bin/env node
import { EDITOR, openEditor } from './editor.mjs'

const { page, close } = await openEditor()

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
  await close()
  process.exit(1)
}

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

const answer = await page.evaluate(() => window.floorplan.exec('get-plan'))
const rooms = answer.ok ? answer.answer.rooms.length : -1
console.log(
  rooms === 0 ? `${open.name} is empty.` : `Not empty: ${JSON.stringify(answer).slice(0, 200)}`,
)
await close()
