import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'

const require = createRequire(import.meta.url)

// TODO: drop once typescript@7.1 ships the public compiler API and
// dependency-cruiser declares support for it (see dependency-cruiser v18.1.0 release notes).
function main() {
  let cruiserDir
  let compatDir
  try {
    cruiserDir = dirname(require.resolve('dependency-cruiser/package.json'))
    compatDir = dirname(require.resolve('@typescript/typescript6/package.json'))
  } catch {
    return
  }

  const nestedModules = join(cruiserDir, 'node_modules')
  const linkPath = join(nestedModules, 'typescript')

  if (resolve(linkPath) === resolve(compatDir)) return

  if (existsSync(linkPath)) {
    if (!lstatSync(linkPath).isSymbolicLink()) return
    rmSync(linkPath)
  }

  mkdirSync(nestedModules, { recursive: true })
  symlinkSync(compatDir, linkPath, 'dir')

  reclaimTscBin()
}

// The compat package depends on typescript@6, whose `tsc` bin wins the hoist race
// against typescript@7 and silently downgrades every `tsc` invocation.
function reclaimTscBin() {
  let typescriptDir
  try {
    typescriptDir = dirname(require.resolve('typescript/package.json'))
  } catch {
    return
  }

  const binDir = resolve('node_modules', '.bin')
  const binPath = join(binDir, 'tsc')
  const target = join(typescriptDir, 'bin', 'tsc')

  if (!existsSync(target) || !existsSync(binDir)) return
  if (existsSync(binPath)) {
    if (!lstatSync(binPath).isSymbolicLink()) return
    rmSync(binPath)
  }

  symlinkSync(relative(binDir, target), binPath)
}

main()
