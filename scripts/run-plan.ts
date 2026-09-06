#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { checkLevel } from '../packages/commands/src/checks'
import { runScript } from '../packages/commands/src/run'
import { createEmptyDocument } from '../packages/core/src/document'
import { roomsOf } from '../packages/geometry/src/rooms'
import { standingAt } from '../packages/geometry/src/standing'

const file = process.argv[2]
if (!file) {
  console.error('usage: bun scripts/run-plan.ts <plan.txt>')
  process.exit(1)
}

const lines = readFileSync(file, 'utf8').split('\n')
let doc = createEmptyDocument()
let failed = false

lines.forEach((line, index) => {
  if (failed) return
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  try {
    doc = runScript(doc, trimmed)
  } catch (error) {
    failed = true
    console.error(`line ${index + 1}: ${trimmed}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  }
})

const level = Object.keys(doc.levels)[0]!
const rooms = roomsOf(doc, level)
const byId = new Map(rooms.filter((room) => room.id).map((room) => [room.id!, room]))

console.log(failed ? '\nstopped there; the plan so far:' : 'ok')
for (const room of rooms) {
  const xs = room.nodes.map((id) => doc.nodes[id]!.x)
  const ys = room.nodes.map((id) => doc.nodes[id]!.y)
  const size = `${(Math.max(...xs) - Math.min(...xs)) / 1000} × ${(Math.max(...ys) - Math.min(...ys)) / 1000} m`
  console.log(
    `${(room.name ?? '?').padEnd(16)} ${(room.area / 1e6).toFixed(1).padStart(5)} m²  ${size.padEnd(14)} floor ${room.floor ?? '-'}`,
  )
  for (const object of Object.values(doc.objects).filter((entry) => entry.room === room.id)) {
    const spot = standingAt(doc, level, room, object)
    const at = spot ? `${Math.round(spot.at.x)},${Math.round(spot.at.y)}` : '?'
    console.log(
      `    ${object.type.padEnd(20)} ${(object.against ?? 'free').padEnd(6)} along ${object.along.toFixed(2)}  at ${at}  ${object.width}×${object.depth}`,
    )
  }
}
const openings = Object.values(doc.openings)
console.log(
  `${openings.filter((o) => o.kind === 'door').length} doors, ${openings.filter((o) => o.kind === 'window').length} windows, ${Object.keys(doc.objects).length} objects`,
)

for (const problem of checkLevel(doc, level)) {
  console.log(`${problem.severity === 'error' ? '!' : '?'} ${problem.code}: ${problem.message}`)
}
if (failed) process.exit(1)
