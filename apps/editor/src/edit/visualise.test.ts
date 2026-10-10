import { expect, test } from 'vitest'
import { promptFor, visualise } from './visualise'

test('the prompt says what kind of room it is and what it is dressed in', () => {
  expect(
    promptFor({
      name: 'living',
      style: 'rustic',
      floor: 'natural-oak',
      walls: 'oak-paneling',
      doors: 'walnut',
    }),
  ).toBe(
    'A living room in Rustic style, oak on floor, walls and ceiling, rough and warm like a mountain cabin, with oak floor, oak boarding walls, walnut doors.',
  )
  expect(promptFor({ name: 'kuchyň', kind: 'kitchen' })).toBe('A kitchen.')
  expect(promptFor(undefined)).toBe('A room.')
})

test('until a model is wired up, a visualisation is what the camera itself sees', async () => {
  const seen = await visualise('A room.', () => 'data:image/jpeg;base64,AAAA')
  expect(seen.image).toBe('data:image/jpeg;base64,AAAA')
  expect(seen.prompt).toBe('A room.')
  await expect(visualise('A room.', () => undefined)).rejects.toThrow(/nothing to show/)
})
