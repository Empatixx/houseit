#!/usr/bin/env node
/**
 * Takes the comments out of the source, everywhere.
 *
 * Tokenised rather than matched: `//` inside a string, a regex or a template
 * literal is not a comment, and a regular expression that thinks it is will
 * quietly eat the middle of a URL. So the scanner from the compiler decides
 * what a comment is, and nothing else does.
 *
 * Two kinds are left alone, because they are read by the toolchain rather than
 * by a person: a directive the linter or the type checker acts on, and the
 * shebang a file is executed through. Stripping those does not make the code
 * quieter, it makes it fail its own checks.
 *
 *   node scripts/strip-comments.mjs            every source file, written back
 *   node scripts/strip-comments.mjs --check    says how many there are, writes nothing
 *   node scripts/strip-comments.mjs a.ts b.tsx just those
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// TypeScript 7 is the native port and publishes barely any JS API; 6 is here
// for the same reason dependency-cruiser needs it, and it has the scanner.
const ts = require('@typescript/typescript6')

/** Where source lives. Configuration at the root is left as it is. */
const ROOTS = ['apps', 'packages', 'scripts']
const SOURCE = new Set(['.ts', '.tsx', '.mjs', '.js'])
const SKIP = new Set(['node_modules', 'dist', '.turbo', '.git'])

/**
 * A comment the tools read. `biome-ignore` suppresses a rule, `@ts-expect-error`
 * is a type assertion in comment form, and `@type` gives a plain JS file its
 * types — take them out and lint and typecheck fail on code that passed.
 */
const DIRECTIVE = /^[\s*/]*(biome-ignore|@ts-|eslint-|prettier-ignore|@type\b|@jsx\b|<reference)/

function* sources(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* sources(path)
    else if (SOURCE.has(extname(entry))) yield path
  }
}

/**
 * Every comment in the text, as ranges, in the order they appear.
 *
 * Parsed rather than scanned. A scanner has to be told when a template literal
 * resumes after its `${…}`, and one that is not told reads the rest of the
 * template as ordinary code — so `` `a ${b} /* c *​/` `` loses the middle of its
 * own string. The parser already knows, so the comments are read off the
 * trivia in front of each token it produced.
 */
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

  // `{/* … */}` in JSX is a comment wearing an expression's clothes: take the
  // comment and `{}` is left behind, which is not what anybody wrote.
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

/**
 * The text without them.
 *
 * A comment standing on its own lines takes those lines with it — left behind,
 * the file is a ladder of blank rungs. One sharing a line with code leaves the
 * code where it is, less the space in front of it.
 */
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
      // The whole line goes, its newline with it, so nothing is left standing.
      if (blank) end = to + blank[0].length
      start = lineStart
    }
    if (start < at) continue
    out += text.slice(at, start)
    at = end
    // A comment at the end of a line of code leaves the space it stood behind.
    if (!alone) out = out.replace(/[^\S\n]+$/, '')
  }
  out += text.slice(at)
  return { text: out, removed: comments.length }
}

const args = process.argv.slice(2)
const checking = args.includes('--check')
const named = args.filter((arg) => !arg.startsWith('--'))
const files =
  named.length > 0 ? named : ROOTS.flatMap((root) => Array.from(sources(root)))

let touched = 0
let total = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  // A shebang is not trivia the scanner reports, but it must survive either way.
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
