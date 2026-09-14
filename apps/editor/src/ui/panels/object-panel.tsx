import type { HouseObject } from '@houseit/core/document'
import { objectType } from '@houseit/core/object-types'
import { SURFACES } from '@houseit/core/surfaces'
import { PaletteIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { finish, remove, resize, roomOf, turnTo } from '../../edit/object-commands'
import { selectionStore } from '../../store/selection'
import { type Choice, FinishRow } from '../finish-picker'
import { Facts, Field, Heading, NumberField } from './fields'

export function ObjectPanel({ object }: { object: HouseObject }) {
  const type = objectType(object.type)
  const room = roomOf(object)
  const surfaces: Choice[] = SURFACES.filter((surface) => type?.surfaces.includes(surface.id)).map(
    (surface) => ({
      id: surface.id,
      label: surface.label,
      colour: surface.fill,
      line: surface.line,
    }),
  )

  return (
    <>
      <Heading>{type?.label ?? object.type}</Heading>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width (mm)">
          <NumberField value={object.width} onCommit={(width) => resize(object, { width })} />
        </Field>
        <Field label="Depth (mm)">
          <NumberField value={object.depth} onCommit={(depth) => resize(object, { depth })} />
        </Field>
      </div>
      <Field label="Turn (°)">
        <NumberField
          value={object.rotation ?? 0}
          onCommit={(rotation) => turnTo(object, rotation)}
        />
      </Field>
      <Facts
        rows={[
          ['Room', room?.name ?? '—'],
          [
            'Stands',
            object.against
              ? `against the ${object.against} wall at ${object.along}`
              : `free at ${object.along} along, ${object.across ?? 0.5} across`,
          ],
        ]}
      />
      <Separator />
      <Heading>Design preference</Heading>
      <FinishRow
        icon={<PaletteIcon />}
        label="Finish"
        title="Add finish"
        chosen={surfaces.find((choice) => choice.id === object.surface)}
        choices={surfaces}
        onPick={(id) => finish(object, id)}
      />
      <Button
        variant="outline"
        size="sm"
        className="hover:border-destructive hover:text-destructive"
        onClick={() => {
          remove(object)
          selectionStore.getState().select(null)
        }}
      >
        Remove
      </Button>
    </>
  )
}
