import type { Opening } from '@houseit/core/document'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { removeOpening, setOpening, whereOpening } from '../../edit/opening-commands'
import { selectionStore } from '../../store/selection'
import { Facts, Field, Heading, NumberField } from './fields'

export function OpeningPanel({ opening }: { opening: Opening }) {
  const where = whereOpening(opening)
  const isDoor = opening.kind === 'door'

  return (
    <>
      <Heading>{isDoor ? 'Door' : 'Window'}</Heading>
      {isDoor ? (
        <Field label="Kind">
          <Select
            value={opening.variant}
            onValueChange={(value) => setOpening(opening, { variant: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['hinged', 'sliding', 'pocket', 'garage'].map((variant) => (
                <SelectItem key={variant} value={variant}>
                  {variant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field label="Width (mm)">
        <NumberField value={opening.width} onCommit={(width) => setOpening(opening, { width })} />
      </Field>
      {isDoor ? null : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Height (mm)">
            <NumberField
              value={opening.height}
              onCommit={(height) => setOpening(opening, { height })}
            />
          </Field>
          <Field label="Sill (mm)">
            <NumberField
              value={opening.sillHeight}
              onCommit={(sill) => setOpening(opening, { sill })}
            />
          </Field>
        </div>
      )}
      <Facts
        rows={[
          ['Room', where?.room.name ?? '—'],
          ['Wall', where ? `${where.side}, ${opening.wall}` : opening.wall],
        ]}
      />
      <Button
        variant="outline"
        size="sm"
        className="hover:border-destructive hover:text-destructive"
        onClick={() => {
          removeOpening(opening)
          selectionStore.getState().select(null)
        }}
      >
        Remove
      </Button>
    </>
  )
}
