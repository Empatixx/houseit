import { expect, test } from 'vitest'
import { createEmptyDocument, parseDocument } from './document'

function documentWithOneWall() {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  return {
    ...doc,
    nodes: { n1: { id: 'n1', x: 0, y: 0 }, n2: { id: 'n2', x: 4000, y: 0 } },
    walls: {
      w1: { id: 'w1', level, a: 'n1', b: 'n2', thickness: 150, baseOffset: 0, height: 2600 },
    },
    level,
  }
}

test('rejects a record whose key disagrees with the entity id', () => {
  const { level, ...doc } = documentWithOneWall()
  const mismatched = { ...doc, nodes: { ...doc.nodes, wrongKey: { id: 'n3', x: 1, y: 1 } } }

  expect(() => parseDocument(mismatched)).toThrow(/wrongKey/)
})

test('rejects an opening hosted on a wall that does not exist', () => {
  const { level, ...doc } = documentWithOneWall()
  const broken = {
    ...doc,
    openings: {
      o1: {
        id: 'o1',
        wall: 'w-missing',
        t: 0.5,
        kind: 'door',
        variant: 'hinged',
        width: 900,
        height: 1970,
        sillHeight: 0,
      },
    },
  }

  expect(() => parseDocument(broken)).toThrow(/w-missing/)
})

test('rejects an opening positioned outside its wall', () => {
  const { level, ...doc } = documentWithOneWall()
  const broken = {
    ...doc,
    openings: {
      o1: {
        id: 'o1',
        wall: 'w1',
        t: 1.4,
        kind: 'door',
        variant: 'hinged',
        width: 900,
        height: 1970,
        sillHeight: 0,
      },
    },
  }

  expect(() => parseDocument(broken)).toThrow()
})

test('accepts a room anchored to a point on a level', () => {
  const { level, ...doc } = documentWithOneWall()
  const withLabel = {
    ...doc,
    rooms: { r1: { id: 'r1', level, x: 2000, y: 1500, name: 'kitchen', loop: [] } },
  }

  expect(parseDocument(withLabel).rooms.r1?.name).toBe('kitchen')
})

test('rejects a device hosted on a wall that does not exist', () => {
  const { level, ...doc } = documentWithOneWall()
  const broken = {
    ...doc,
    devices: {
      d1: {
        id: 'd1',
        kind: 'socket',
        discipline: 'electrical',
        host: { kind: 'wall', wall: 'w-missing', t: 0.4, z: 300, side: 'a' },
      },
    },
  }

  expect(() => parseDocument(broken)).toThrow(/w-missing/)
})

test('accepts a ceiling light hosted on a level rather than a room', () => {
  const { level, ...doc } = documentWithOneWall()
  const withLight = {
    ...doc,
    devices: {
      d1: {
        id: 'd1',
        kind: 'light',
        discipline: 'electrical',
        host: { kind: 'level', level, x: 2000, y: 1500, z: 2600 },
      },
    },
  }

  expect(parseDocument(withLight).devices.d1?.kind).toBe('light')
})

test('rejects a circuit listing a device that does not exist', () => {
  const { level, ...doc } = documentWithOneWall()
  const broken = {
    ...doc,
    devices: {
      p1: {
        id: 'p1',
        kind: 'panel',
        discipline: 'electrical',
        host: { kind: 'wall', wall: 'w1', t: 0.1, z: 1400, side: 'a' },
      },
    },
    circuits: { c1: { id: 'c1', panel: 'p1', breaker: 'B16', devices: ['d-missing'] } },
  }

  expect(() => parseDocument(broken)).toThrow(/d-missing/)
})
