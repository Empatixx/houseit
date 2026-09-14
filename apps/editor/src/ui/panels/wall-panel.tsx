import type { Wall } from '@houseit/core/document'
import { wallElement } from '@houseit/geometry/wall-elements'
import { nameWall, setWall } from '../../edit/wall-commands'
import { useDocument } from '../../store/store'
import { Facts, Field, Heading, NumberField } from './fields'

export function WallPanel({ wall }: { wall: Wall }) {
  const doc = useDocument((state) => state.doc)
  const element = wallElement(doc, wall.id)
  const length = Math.round(element.length)
  const named = nameWall(wall)
  return (
    <>
      <Heading>Wall</Heading>
      <Field label="Thickness (mm)">
        <NumberField
          value={wall.thickness}
          onCommit={(thickness) => setWall(wall, { thickness })}
        />
      </Field>
      <Field label="Height (mm)">
        <NumberField value={wall.height} onCommit={(height) => setWall(wall, { height })} />
      </Field>
      <Field label="Base (mm)">
        <NumberField value={wall.baseOffset} onCommit={(base) => setWall(wall, { base })} />
      </Field>
      <Facts
        rows={[
          ['Wall', element.id],
          ['Length', `${length} mm`],
          ['Bounds', named ? `${named.room.name}, ${named.side} side` : '—'],
        ]}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Drag the wall or round handle to move it, including its openings and connected walls. Square
        handles resize free ends. Delete removes the wall and its openings.
      </p>
    </>
  )
}
