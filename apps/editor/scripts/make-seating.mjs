import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const mac = '/Applications/Blender.app/Contents/MacOS/Blender'
const blender = process.env.BLENDER_PATH || (existsSync(mac) ? mac : 'blender')
const script = fileURLToPath(new URL('./make-seating.py', import.meta.url))
const result = spawnSync(blender, ['--background', '--python', script], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
