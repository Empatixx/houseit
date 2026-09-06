#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('@typescript/typescript6')

const ROOTS = ['apps', 'packages', 'scripts']
const SOURCE = new Set(['.ts', '.tsx', '.mjs', '.js'])
const SKIP = new Set(['node_modules', 'dist', '.turbo', '.git'])

const DIRECTIVE = /^[\s*/]*(biome-ignore|@ts-|eslint-|prettier-ignore|@type\b|@jsx\b|<reference)/

function* sources(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* sources(path)
    else if (SOURCE.has(extname(entry))) yield path
  }
}

function commentsIn(text, jsx) {
  const source = ts.createSourceFile(
    jsx ? 'f.tsx' : 'f.ts',
    text,
    ts.ScriptTarget.Latest,
    true,
    jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const found = []
  const seen = new Set()
  const add = (from, to) => {
    const key = `${from}:${to}`
    if (seen.has(key)) return
    seen.add(key)
    found.push({ from, to })
  }

  const walk = (node) => {
    const children = node.getChildren(source)
    if (children.length === 0) {
      for (const range of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
        add(range.pos, range.end)
      }
      for (const range of ts.getTrailingCommentRanges(text, node.getEnd()) ?? []) {
        add(range.pos, range.end)
      }
      return
    }
    for (const child of children) walk(child)
  }
  walk(source)

  const empties = []
  const containers = (node) => {
    if (ts.isJsxExpression(node) && node.expression === undefined) {
      empties.push({ from: node.getStart(source), to: node.getEnd() })
    }
    ts.forEachChild(node, containers)
  }
  containers(source)
  for (const empty of empties) add(empty.from, empty.to)

  const inside = (range, empty) =>
    empty.from <= range.from &&
    range.to <= empty.to &&
    !(empty.from === range.from && empty.to === range.to)

  return found
    .filter((range) => !empties.some((empty) => inside(range, empty)))
    .sort((one, other) => one.from - other.from)
}

function withoutComments(text, jsx) {
  const comments = commentsIn(text, jsx).filter(
    ({ from, to }) => !DIRECTIVE.test(text.slice(from, to)),
  )
  if (comments.length === 0) return { text, removed: 0 }

  let out = ''
  let at = 0
  for (const { from, to } of comments) {
    const lineStart = text.lastIndexOf('\n', from - 1) + 1
    const alone = text.slice(lineStart, from).trim() === ''
    let end = to
    let start = from
    if (alone) {
      const rest = text.slice(to)
      const blank = rest.match(/^[^\S\n]*\n/)
      if (blank) end = to + blank[0].length
      start = lineStart
    }
    if (start < at) continue
    out += text.slice(at, start)
    at = end
    if (!alone) out = out.replace(/[^\S\n]+$/, '')
  }
  out += text.slice(at)
  return { text: out, removed: comments.length }
}

const args = process.argv.slice(2)
const checking = args.includes('--check')
const named = args.filter((arg) => !arg.startsWith('--'))
const files = named.length > 0 ? named : ROOTS.flatMap((root) => Array.from(sources(root)))

let touched = 0
let total = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const shebang = text.startsWith('#!') ? text.slice(0, text.indexOf('\n') + 1) : ''
  const body = text.slice(shebang.length)
  const { text: stripped, removed } = withoutComments(body, extname(file) === '.tsx')
  if (removed === 0) continue
  touched += 1
  total += removed
  if (!checking) writeFileSync(file, shebang + stripped)
}

const said = checking ? 'would go' : 'gone'
process.stdout.write(`${total} comments ${said}, in ${touched} files\n`)
process.exit(checking && total > 0 ? 1 : 0)
