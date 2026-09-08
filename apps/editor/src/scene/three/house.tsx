import type { Owner, Piece } from '@houseit/scene/pieces'
import { worldOf } from '@houseit/scene/world'
import { useMemo } from 'react'
import { pick } from '../../edit/pick'
import { EMPHASIS } from '../../store/hover'
import { type Selection, useSelection } from '../../store/selection'
import { usePlanDoc } from '../../store/store'
import { dragged } from '../drag'
import { MM } from '../plan-coordinates'
import { StandingPiece } from './piece'

const FLOOR_PICKED = '#9db9ff'

export function House({ picking = true }: { picking?: boolean }) {
  const doc = usePlanDoc()
  const selected = useSelection((state) => state.selected)
  const world = useMemo(() => worldOf(doc), [doc])

  return (
    <>
      {world.storeys.map((storey) => (
        <group key={storey.level} position={[0, storey.elevation * MM, 0]}>
          {storey.pieces.map((piece) => (
            <StandingPiece
              key={piece.name}
              piece={piece}
              tint={tintOf(piece, selected)}
              onPick={picking ? picker(piece.of) : undefined}
            />
          ))}
        </group>
      ))}
    </>
  )
}

function tintOf(piece: Piece, selected: Selection | null): string | undefined {
  const of = piece.of
  if (!of || !selected || selected.kind !== of.kind || selected.id !== of.id) return undefined
  if (of.kind === 'room') return FLOOR_PICKED
  if (of.kind === 'object') return EMPHASIS.picked.tint
  if ((piece.paint.opacity ?? 1) < 1) return EMPHASIS.picked.glass
  return EMPHASIS.picked.fill
}

const picker =
  (of: Owner | undefined) => (event: { delta: number; stopPropagation: () => void }) => {
    if (dragged(event)) return
    event.stopPropagation()
    pick(of ? { kind: of.kind, id: of.id } : null)
  }
