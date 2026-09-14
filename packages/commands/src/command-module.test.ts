import { expect, test } from 'vitest'
import { commandRegistry } from './command-module'
import { addDevice } from './device'
import { getPlan } from './get-plan'

test('shared queries and profession commands retain their declared objects and order', () => {
  const registry = commandRegistry([{ discipline: 'electrical', commands: [addDevice] }], [getPlan])
  expect([...registry.keys()]).toEqual(['get-plan', 'add-device'])
  expect(registry.get('add-device')).toBe(addDevice)
})

test('a profession cannot silently replace a shared or another profession command', () => {
  expect(() => commandRegistry([{ discipline: 'hvac', commands: [getPlan] }], [getPlan])).toThrow(
    'Duplicate command: get-plan',
  )
  expect(() =>
    commandRegistry([
      { discipline: 'electrical', commands: [addDevice] },
      { discipline: 'plumbing', commands: [addDevice] },
    ]),
  ).toThrow('Duplicate command: add-device')
})
