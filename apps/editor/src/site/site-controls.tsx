import { updateSite } from '@houseit/commands/update-site'
import type { Site } from '@houseit/core/parcel-site'
import { LocateFixedIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { runEdit } from '../edit/run-edit'
import { drawingOfSite } from '../scene/site-drawing'
import { documentStore } from '../store/store'
import { viewStore } from '../store/view'

export function SiteControls({ site }: { site: Site }) {
  const drawing = drawingOfSite(site)
  const change = (args: Parameters<typeof updateSite.apply>[1]) =>
    runEdit(() => documentStore.getState().apply(updateSite, args))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Position X"
          value={site.housePlacement.xMm / 1000}
          unit="m"
          onCommit={(value) => change({ x: value * 1000 })}
        />
        <NumberField
          label="Position Y"
          value={site.housePlacement.yMm / 1000}
          unit="m"
          onCommit={(value) => change({ y: value * 1000 })}
        />
        <NumberField
          label="Rotation"
          value={site.housePlacement.rotationMilliDegrees / 1000}
          unit="°"
          onCommit={(rotation) => change({ rotation })}
        />
        <NumberField
          label="Default setback"
          value={site.setbacks.defaultMm / 1000}
          unit="m"
          min={0}
          onCommit={(value) => change({ setback: value * 1000 })}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => change({ setback: 2000 })}>
          2 m preset
        </Button>
        <Button variant="outline" size="sm" onClick={() => frameSite(site)}>
          <LocateFixedIcon /> Fit parcel
        </Button>
      </div>
      <details className="rounded-lg border bg-background/60 p-2">
        <summary className="cursor-pointer text-xs font-medium">
          Setbacks by boundary ({drawing.edges.length})
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {drawing.edges.map((edge, index) => (
            <NumberField
              key={edge.id}
              label={`Boundary ${index + 1}`}
              value={edge.setbackMm / 1000}
              unit="m"
              min={0}
              onCommit={(value) => change({ edge: edge.id, edgeSetback: Math.round(value * 1000) })}
            />
          ))}
        </div>
      </details>
    </div>
  )
}

function NumberField({
  label,
  value,
  unit,
  min,
  onCommit,
}: {
  label: string
  value: number
  unit: string
  min?: number
  onCommit: (value: number) => boolean
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const number = Number(text.replace(',', '.'))
    if (!Number.isFinite(number) || (min !== undefined && number < min) || !onCommit(number)) {
      setText(String(value))
    }
  }

  return (
    <label className="min-w-0">
      <Label className="mb-1 block text-xs font-normal">{label}</Label>
      <span className="relative block">
        <Input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setText(String(value))
          }}
          className="pr-7 tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
      </span>
    </label>
  )
}

function frameSite(site: Site): void {
  const points = drawingOfSite(site).parcels.flatMap((polygon) => [
    ...polygon.outer,
    ...polygon.holes.flat(),
  ])
  if (points.length === 0) return
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  viewStore.getState().frame({
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  })
}
