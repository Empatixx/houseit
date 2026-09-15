import type { Opening } from '@houseit/core/document'

export function hingeAt(swing: -1 | 1, hand: 'left' | 'right'): 'a' | 'b' {
  return (hand === 'left') === (swing === -1) ? 'a' : 'b'
}

export function handOf(opening: Pick<Opening, 'hinge' | 'swing'>): 'left' | 'right' {
  return opening.hinge === hingeAt(opening.swing, 'left') ? 'left' : 'right'
}
