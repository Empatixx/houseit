import { describe, expect, test } from 'vitest'
import { createEmptyDocument, DOCUMENT_VERSION, parseDocument } from './document'

describe('createEmptyDocument', () => {
  test('starts with a single ground level and nothing drawn on it', () => {
    const doc = createEmptyDocument()

    expect(doc.version).toBe(DOCUMENT_VERSION)
    expect(Object.keys(doc.levels)).toHaveLength(1)
    expect(doc.nodes).toEqual({})
    expect(doc.walls).toEqual({})
  })

  test('produces a document that its own schema accepts', () => {
    expect(() => parseDocument(createEmptyDocument())).not.toThrow()
  })
})

describe('parseDocument', () => {
  test('rejects a wall whose endpoint node is missing', () => {
    const doc = createEmptyDocument()
    const level = Object.keys(doc.levels)[0]!
    const broken = {
      ...doc,
      nodes: { n1: { id: 'n1', x: 0, y: 0 } },
      walls: {
        w1: {
          id: 'w1',
          level,
          a: 'n1',
          b: 'n-missing',
          thickness: 150,
          baseOffset: 0,
          height: 2600,
        },
      },
    }

    expect(() => parseDocument(broken)).toThrow(/n-missing/)
  })

  test('rejects a length that is not a whole millimetre', () => {
    const doc = createEmptyDocument()
    const broken = { ...doc, nodes: { n1: { id: 'n1', x: 0.5, y: 0 } } }

    expect(() => parseDocument(broken)).toThrow()
  })
})
