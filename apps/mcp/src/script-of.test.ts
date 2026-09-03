import { expect, test } from 'vitest'
import { scriptOf } from './script-of'

test('several arguments are one command, with names of more than one word kept whole', () => {
  expect(scriptOf(['add-room', '--name', 'master bedroom', '--width', '4m'])).toBe(
    'add-room --name "master bedroom" --width 4m',
  )
})

test('one argument with spaces in it is a script as written, quotes and all', () => {
  const script =
    'add-room --name "Ložnice 2" --points "0,0; 4m,0; 4m,3m"\ndescribe --room "Ložnice 2"'
  expect(scriptOf([script])).toBe(script)
})

test('one bare word is a command on its own', () => {
  expect(scriptOf(['check-plan'])).toBe('check-plan')
})
