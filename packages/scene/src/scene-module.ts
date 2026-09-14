import type { Discipline, HouseDocument } from '@houseit/core/document'
import type { Piece } from './pieces'

export type SceneModule = {
  discipline: Discipline
  pieces: (doc: HouseDocument, level: string) => Piece[]
}

export function piecesForModules(
  modules: readonly SceneModule[],
  doc: HouseDocument,
  level: string,
  visible?: ReadonlySet<Discipline>,
): Piece[] {
  const names = new Set<string>()
  return modules
    .filter((module) => !visible || visible.has(module.discipline))
    .flatMap((module) =>
      module.pieces(doc, level).map((piece, index) => {
        const name = piece.name ?? `${module.discipline}-piece-${index}`
        const key = `${piece.role === 'wall-solid' ? 'wall' : 'surface'}:${name}`
        if (names.has(key)) throw new Error(`Duplicate scene piece: ${name}`)
        names.add(key)
        return piece.name ? piece : { ...piece, name }
      }),
    )
}
