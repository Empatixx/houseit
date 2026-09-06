export const MM = 0.001

export function toWorld(x: number, y: number, up = 0): [number, number, number] {
  return [x * MM, up * MM, -y * MM]
}
