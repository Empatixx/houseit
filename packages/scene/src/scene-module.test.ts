import { createEmptyDocument } from '@houseit/core/document'
import { expect, test, vi } from 'vitest'
import { slab } from './pieces'
import { piecesForModules } from './scene-module'

test('only visible profession providers execute, against the same document and level', () => {
  const doc = createEmptyDocument(),
    level = Object.keys(doc.levels)[0]!
  const pieces = [slab({ w: 100, h: 100, d: 100, paint: { colour: '#fff' } })]
  const electrical = vi.fn(() => pieces),
    plumbing = vi.fn(() => [])
  const result = piecesForModules(
    [
      { discipline: 'electrical', pieces: electrical },
      { discipline: 'plumbing', pieces: plumbing },
    ],
    doc,
    level,
    new Set(['electrical']),
  )
  expect(electrical).toHaveBeenCalledWith(doc, level)
  expect(plumbing).not.toHaveBeenCalled()
  expect(result[0]?.name).toBe('electrical-piece-0')
  expect(pieces[0]?.name).toBeUndefined()
})

test('conflicting piece identities fail before they can overwrite native display items', () => {
  const doc = createEmptyDocument(),
    level = Object.keys(doc.levels)[0]!
  const piece = { ...slab({ w: 1, h: 1, d: 1, paint: { colour: '#fff' } }), name: 'same' }
  expect(() =>
    piecesForModules(
      [
        { discipline: 'electrical', pieces: () => [piece] },
        { discipline: 'hvac', pieces: () => [piece] },
      ],
      doc,
      level,
    ),
  ).toThrow('Duplicate scene piece: same')
})

test('native wall bodies and their facade surfaces retain separate display identities', () => {
  const doc = createEmptyDocument(),
    level = Object.keys(doc.levels)[0]!
  const piece = { ...slab({ w: 1, h: 1, d: 1, paint: { colour: '#fff' } }), name: 'wall-w1-1' }
  const result = piecesForModules(
    [
      {
        discipline: 'architecture',
        pieces: () => [
          { ...piece, role: 'wall-solid' },
          { ...piece, role: 'facade-covering' },
        ],
      },
    ],
    doc,
    level,
  )
  expect(result.map((part) => part.name)).toEqual(['wall-w1-1', 'wall-w1-1'])
})
