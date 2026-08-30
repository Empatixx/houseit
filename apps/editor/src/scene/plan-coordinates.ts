/** Scene units are metres; the document is in millimetres. */
export const MM = 0.001

/**
 * Plan (x, y) maps to world (x, z_up, -y). The negation is what lets a top-down
 * camera show +x to the right and +y up the screen at the same time — with +y
 * mapped straight to +z one of the two axes always comes out mirrored.
 */
export function toWorld(x: number, y: number, up = 0): [number, number, number] {
  return [x * MM, up * MM, -y * MM]
}
