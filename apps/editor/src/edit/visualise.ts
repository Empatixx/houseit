import type { Room } from '@houseit/core/document'
import { finishOf, PARTS, styleOf } from '@houseit/core/finishes'
import { floorMaterial } from '@houseit/core/floor-materials'
import { roomKindOf } from '@houseit/core/room-kinds'

export type Visualised = { image: string; prompt: string; at: number }

const THINKING = 1200

export function promptFor(
  record:
    | Pick<Room, 'name' | 'kind' | 'floor' | 'style' | 'walls' | 'ceiling' | 'doors' | 'windows'>
    | undefined,
): string {
  if (!record) return 'A room.'
  const kind = roomKindOf(record)?.label ?? 'room'
  const style = styleOf(record.style)
  const worn: string[] = []
  const floor = floorMaterial(record.floor ?? '')
  if (floor) worn.push(`${floor.label.toLowerCase()} floor`)
  for (const part of PARTS) {
    const finish = finishOf(record[part])
    if (finish) worn.push(`${finish.label.toLowerCase()} ${part}`)
  }
  const styled = style ? ` in ${style.label} style, ${style.blurb}` : ''
  const dressed = worn.length === 0 ? '' : `, with ${worn.join(', ')}`
  return `A ${kind.toLowerCase()}${styled}${dressed}.`
}

export async function visualise(
  prompt: string,
  seen: () => string | undefined,
): Promise<Visualised> {
  await new Promise((resolve) => setTimeout(resolve, THINKING))
  const image = seen()
  if (!image) throw new Error('the camera has nothing to show yet')
  return { image, prompt, at: Date.now() }
}
