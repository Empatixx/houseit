import type { HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { roomsOf } from '@houseit/geometry/rooms'
import { current, type Draft, isDraft } from 'immer'
import { z } from 'zod'
import { checkLevel } from './checks'
import { CommandError } from './command-error'
import type { AnyCommand, Change, TypedCommand } from './define-command'
import { REGISTRY } from './registry'
import { levelOf, whereRoom } from './resolve'
import { scriptLines } from './script-lines'
import { surveyLevel, surveyRoom } from './survey'

export type ProgramOutcome = {
  changed: string[]
  shown: string[]
  at?: string
  notes?: string[]
  result?: unknown
  logs?: string[]
}

const MARK = /^\s*#!js[^\n]*\n?/

export function isProgram(source: string): boolean {
  return MARK.test(source) || /^\s*export\s+default\b/.test(source)
}

export const camelOf = (name: string) =>
  name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())

const typed = (command: AnyCommand): command is TypedCommand =>
  'apply' in command && 'args' in command

const HIDDEN = [
  'window',
  'document',
  'globalThis',
  'self',
  'fetch',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'importScripts',
] as const

export function runProgram(
  draft: Draft<HouseDocument>,
  source: string,
  open?: string,
): ProgramOutcome {
  const changed: string[] = []
  const shown: string[] = []
  const notes: string[] = []
  const logs: string[] = []
  let at: string | undefined
  let level = open

  let seen: HouseDocument | undefined
  const reads = new Map<string, unknown>()
  const frozen = () => {
    if (!seen) {
      seen = current(draft) as HouseDocument
      reads.clear()
    }
    return seen
  }
  const remembered = <T>(key: string, read: (doc: HouseDocument) => T): T => {
    const doc = frozen()
    if (!reads.has(key)) reads.set(key, read(doc))
    return structuredClone(reads.get(key) as T)
  }

  const record = (said: Change | undefined) => {
    seen = undefined
    for (const id of said?.changed ?? []) if (!changed.includes(id)) changed.push(id)
    for (const id of said?.shown ?? []) if (!shown.includes(id)) shown.push(id)
    if (said?.at !== undefined) at = said.at
    notes.push(...(said?.notes ?? []))
    return {
      changed: [...(said?.changed ?? [])],
      shown: [...(said?.shown ?? [])],
      ...(said?.changed?.[0] === undefined ? {} : { id: said.changed[0] }),
      ...(said?.at === undefined ? {} : { at: said.at }),
      ...(said?.notes?.length ? { notes: [...said.notes] } : {}),
    }
  }

  const call = (command: AnyCommand, args: unknown) => {
    if (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args))) {
      throw new CommandError(`${command.name}: takes one object of options`)
    }
    if (!typed(command)) {
      throw new CommandError(`${command.name}: has no typed form, use ctx.run`)
    }
    return record(command.apply(draft, (args ?? {}) as never, level))
  }

  const snapshot = () => structuredClone(frozen())
  const levelId = (given?: string) => levelOf(draft, given ?? level, 'ctx')

  const ctx: Record<string, unknown> = {
    run: (lines: string) => {
      const said: Change = { changed: [], shown: [], notes: [] }
      for (const [name, ...argv] of scriptLines(lines)) {
        if (!name) continue
        const command = REGISTRY.get(name)
        if (!command) throw new CommandError(`Unknown command "${name}"`)
        const one = command.execute(draft, argv, level)
        said.changed!.push(...(one?.changed ?? []))
        said.shown!.push(...(one?.shown ?? []))
        said.notes!.push(...(one?.notes ?? []))
        if (one?.at !== undefined) said.at = one.at
      }
      return record(said)
    },
    doc: snapshot,
    levels: () =>
      levelsOf(frozen()).map((storey, index) => ({
        id: storey.id,
        name: storey.name,
        storey: index + 1,
        elevation: storey.elevation,
        height: storey.height,
        ...(storey.id === levelId() ? { open: true } : {}),
      })),
    useLevel: (given: string) => {
      level = levelOf(draft, given, 'ctx.useLevel')
      at = level
      return level
    },
    rooms: (given?: string) => {
      const at = levelOf(frozen(), given ?? level, 'ctx.rooms')
      return remembered(`rooms:${at}`, (doc) => surveyLevel(doc, at).rooms)
    },
    room: (name: string, given?: string) =>
      remembered(`room:${given ?? ''}:${name}`, (doc) => {
        const found = whereRoom(doc, given, name, 'ctx.room')
        return surveyRoom(doc, found.level, found.room, roomsOf(doc, found.level))
      }),
    problems: (given?: string) => {
      const at = levelOf(frozen(), given ?? level, 'ctx.problems')
      return remembered(`problems:${at}`, (doc) => checkLevel(doc, at))
    },
    show: (...ids: string[]) => {
      for (const id of ids) if (!shown.includes(id)) shown.push(id)
    },
    log: (...values: unknown[]) => {
      logs.push(values.map((value) => (typeof value === 'string' ? value : json(value))).join(' '))
    },
    help: (name?: string) => (name === undefined ? programHelp() : signatureOf(name)),
  }
  for (const command of REGISTRY.values())
    ctx[camelOf(command.name)] = (args?: unknown) => call(command, args)

  const body = source.replace(MARK, '').replace(/^\s*export\s+default\b/m, 'return ')
  if (/^\s*import\b/m.test(body)) {
    throw new CommandError('program: import is not available, everything is on ctx')
  }

  let value: unknown
  try {
    const program = new Function('ctx', ...HIDDEN, `"use strict";\n${body}`)
    value = program(Object.freeze(ctx), ...HIDDEN.map(() => undefined))
    if (typeof value === 'function') value = value(ctx)
  } catch (error) {
    if (error instanceof CommandError) throw error
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    throw new CommandError(`program: ${message}`)
  }
  if (
    value instanceof Promise ||
    (typeof value === 'object' && value !== null && 'then' in value)
  ) {
    throw new CommandError(
      'program: it returned a promise — the whole program is one synchronous transaction, drop async/await',
    )
  }

  return {
    changed,
    shown,
    ...(at === undefined ? {} : { at }),
    ...(notes.length === 0 ? {} : { notes }),
    ...(value === undefined ? {} : { result: plain(value) }),
    ...(logs.length === 0 ? {} : { logs }),
  }
}

function plain(value: unknown): unknown {
  const text = json(isDraft(value) ? current(value) : value)
  return text === undefined ? String(value) : JSON.parse(text)
}

function json(value: unknown): string {
  return JSON.stringify(value, (_, entry) => (isDraft(entry) ? current(entry) : entry))
}

export function signatureOf(name: string): string {
  const command =
    REGISTRY.get(name) ?? [...REGISTRY.values()].find((it) => camelOf(it.name) === name)
  if (!command) throw new CommandError(`ctx.help: there is no command ${name}`)
  if (!typed(command)) return `ctx.${camelOf(command.name)}() — ${command.summary}`
  const fields = Object.entries(command.args.shape).map(([key, field]) => {
    const schema = field as z.ZodType
    const optional = schema.safeParse(undefined).success
    return `${key}${optional ? '?' : ''}: ${typeOf(schema)}`
  })
  return `ctx.${camelOf(command.name)}({ ${fields.join(', ')} })\n    ${command.summary}`
}

function typeOf(schema: z.ZodType): string {
  try {
    return render(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Shape)
  } catch {
    return 'unknown'
  }
}

type Shape = {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  anyOf?: Shape[]
  oneOf?: Shape[]
  items?: Shape
  properties?: Record<string, Shape>
  required?: string[]
}

function render(shape: Shape, depth = 0): string {
  if (shape.enum) {
    return shape.enum.length > 8 ? 'string' : shape.enum.map((it) => JSON.stringify(it)).join('|')
  }
  if (shape.const !== undefined) return JSON.stringify(shape.const)
  const union = shape.anyOf ?? shape.oneOf
  if (union) {
    const parts = [...new Set(union.map((it) => render(it, depth)))]
    if (parts.includes('string') && parts.includes('number')) return 'length'
    return parts.join('|')
  }
  if (Array.isArray(shape.type)) {
    const types = shape.type.map((it) => (it === 'integer' ? 'number' : it))
    return types.includes('string') && types.includes('number') ? 'length' : types.join('|')
  }
  const type = shape.type
  if (type === 'array') return `${render(shape.items ?? {}, depth)}[]`
  if (type === 'object' && shape.properties) {
    if (depth > 2) return 'object'
    const required = new Set(shape.required ?? [])
    const inner = Object.entries(shape.properties)
      .map(([key, entry]) => `${key}${required.has(key) ? '' : '?'}: ${render(entry, depth + 1)}`)
      .join(', ')
    return `{ ${inner} }`
  }
  if (type === 'integer') return 'number'
  return type ?? 'any'
}

export function programHelp(): string {
  return [
    'A program is JavaScript instead of command lines. Start it with a line `#!js`, or',
    'write it as `export default (ctx) => { … }`. It runs synchronously inside the same',
    'single transaction as a script: if it throws, nothing changes. No import, no await,',
    'no window or fetch — everything is on ctx. Its return value comes back as `result`,',
    'ctx.log(…) as `logs`, and the usual answer and picture follow.',
    '',
    'Every command is a function taking one object whose keys are its options in',
    'camelCase: add-room --notch-width 2m is ctx.addRoom({ notchWidth: "2m" }). Lengths',
    'are millimetres or strings with a unit. JSON options take plain objects and arrays.',
    'Each call returns { id, changed, shown, at?, notes? } — id is the first thing it made.',
    '',
    'Reading, never writing: ctx.rooms(level?), ctx.room(name, level?), ctx.problems(level?),',
    'ctx.levels(), ctx.doc() (a copy of the whole document). ctx.useLevel(name) makes',
    'later calls work on that storey. ctx.run("add-room …") runs command lines as written.',
    'ctx.show(...ids) adds rooms to the answer. ctx.help("add-room") gives one signature.',
    '',
    'Functions:',
    '',
    ...[...REGISTRY.values()].map((command) => signatureOf(command.name)),
  ].join('\n')
}
