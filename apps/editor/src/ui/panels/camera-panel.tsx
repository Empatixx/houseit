import type { HouseObject } from '@houseit/core/document'
import { standingAt } from '@houseit/geometry/standing'
import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { sayError } from '../../edit/notice'
import { remove, roomOf, stopTurning, turningTo, turnTo } from '../../edit/object-commands'
import { promptFor, type Visualised, visualise } from '../../edit/visualise'
import { selectionStore } from '../../store/selection'
import { useDocument, usePlanDoc } from '../../store/store'
import { CameraView } from '../camera-view'
import { Facts, Field, Heading, NumberField } from './fields'

export function CameraPanel({ object }: { object: HouseObject }) {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  const live = doc.objects[object.id] ?? object
  const room = roomOf(live)
  const spot = room ? standingAt(doc, level, room, live) : undefined
  const record = room?.id === undefined ? undefined : doc.rooms[room.id]
  const suggested = promptFor(record)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [seen, setSeen] = useState<Visualised | null>(null)
  const eye = useRef<() => string | undefined>(() => undefined)
  const ready = useCallback((take: () => string | undefined) => {
    eye.current = take
  }, [])

  const generate = async () => {
    setBusy(true)
    try {
      setSeen(await visualise(prompt.trim() || suggested, () => eye.current()))
    } catch (error) {
      sayError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Heading>Camera</Heading>
      {spot ? <CameraView spot={spot} level={level} onReady={ready} /> : null}
      <Field label="Turn (°)">
        <NumberField value={live.rotation ?? 0} onCommit={(rotation) => turnTo(object, rotation)} />
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={live.rotation ?? 0}
          aria-label="Turn the camera"
          onChange={(event) => turningTo(object, Number(event.target.value))}
          onPointerUp={(event) => settle(object, Number(event.currentTarget.value))}
          onKeyUp={(event) => settle(object, Number(event.currentTarget.value))}
          onBlur={(event) => settle(object, Number(event.currentTarget.value))}
          className="w-full accent-primary"
        />
      </Field>
      <Facts rows={[['Room', room?.name ?? '—']]} />
      <Separator />
      <Heading>Visualise</Heading>
      <Field label="Prompt">
        <textarea
          value={prompt}
          placeholder={suggested}
          rows={4}
          onChange={(event) => setPrompt(event.target.value)}
          className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>
      <Button size="sm" disabled={busy} onClick={() => void generate()}>
        {busy ? 'Generating…' : 'Generate'}
      </Button>
      {seen ? (
        <figure className="flex flex-col gap-1.5">
          <img
            src={seen.image}
            alt="What the camera sees"
            draggable={false}
            className="aspect-[4/3] w-full rounded-lg border object-cover"
          />
          <figcaption className="text-xs leading-5 text-muted-foreground">
            Not a render yet, the camera's own view. Asked for: {seen.prompt}
          </figcaption>
        </figure>
      ) : null}
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

function settle(object: HouseObject, degrees: number): void {
  turnTo(object, degrees)
  stopTurning()
}
