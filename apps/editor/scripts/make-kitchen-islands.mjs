import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const mac = '/Applications/Blender.app/Contents/MacOS/Blender'
const blender = process.env.BLENDER_PATH || (existsSync(mac) ? mac : 'blender')
const script = fileURLToPath(new URL('./make-kitchen-islands.py', import.meta.url))
const models = process.argv.slice(2)
const result = spawnSync(
  blender,
  [
    '--background',
    '--python-exit-code',
    '1',
    '--python',
    script,
    ...(models.length ? ['--', ...models] : []),
  ],
  { stdio: 'inherit' },
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
