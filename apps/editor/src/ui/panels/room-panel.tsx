import { finishesFor, finishOf, isColour, type Part, STYLES, styleOf } from '@houseit/core/finishes'
import { FLOOR_MATERIALS, floorMaterial } from '@houseit/core/floor-materials'
import { ROOM_KINDS, roomKindOf } from '@houseit/core/room-kinds'
import { interiorSize } from '@houseit/geometry/dimensions'
import type { Room } from '@houseit/geometry/rooms'
import {
  BlindsIcon,
  BrickWallIcon,
  CameraIcon,
  DoorOpenIcon,
  LayersIcon,
  PaletteIcon,
  PanelTopIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { placeCamera } from '../../edit/object-commands'
import { pick } from '../../edit/pick'
import { layFloor, setFinish, setKind, setStyle } from '../../edit/room-commands'
import { useDocument } from '../../store/store'
import { KindIcon } from '../avatars'
import { RoomViewSettings } from '../engine-settings'
import { type Choice, FinishRow } from '../finish-picker'
import { Facts, Field, Heading } from './fields'

const FLOOR_CHOICES: Choice[] = FLOOR_MATERIALS.map((material) => ({
  id: material.id,
  label: material.label,
  picture: `textures/${material.texture}`,
}))

const WEARS: { part: Part; label: string; icon: ReactNode }[] = [
  { part: 'walls', label: 'Walls', icon: <BrickWallIcon /> },
  { part: 'ceiling', label: 'Ceiling', icon: <PanelTopIcon /> },
  { part: 'doors', label: 'Doors', icon: <DoorOpenIcon /> },
  { part: 'windows', label: 'Windows', icon: <BlindsIcon /> },
]

export function RoomPanel({ room }: { room: Room }) {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const size = interiorSize(doc, level, room)
  const kind = roomKindOf(room)
  const record = room.id === undefined ? undefined : doc.rooms[room.id]
  const floor = floorMaterial(room.floor ?? '')

  return (
    <>
      <Heading>Room</Heading>
      <Field label="Kind">
        <Select
          value={room.kind ?? 'none'}
          onValueChange={(value) => value !== 'none' && setKind(room, value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <KindIcon id={kind?.id} />
              {kind ? `${kind.label} (from the name)` : 'not said'}
            </SelectItem>
            {ROOM_KINDS.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <KindIcon id={entry.id} />
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Facts
        rows={[
          ['Width', `${size.width} mm`],
          ['Depth', `${size.depth} mm`],
          ['Area', `${(room.clear / 1_000_000).toFixed(1)} m²`],
        ]}
      />
      <RoomViewSettings />
      <Separator />
      <Heading>Design preference</Heading>
      <FinishRow
        icon={<PaletteIcon />}
        label="Style"
        title="Add style"
        chosen={styleOf(record?.style)}
        choices={STYLES}
        onPick={(id) => setStyle(room, id)}
      />
      <Heading>Fine-tuning</Heading>
      <FinishRow
        icon={<LayersIcon />}
        label="Floor"
        title="Add finish"
        chosen={FLOOR_CHOICES.find((choice) => choice.id === floor?.id)}
        choices={FLOOR_CHOICES}
        onPick={(id) => layFloor(room, id)}
      />
      {WEARS.map(({ part, label, icon }) => (
        <FinishRow
          key={part}
          icon={icon}
          label={label}
          title="Add finish"
          chosen={wornAs(record?.[part])}
          choices={finishesFor(part)}
          own
          onPick={(id) => setFinish(room, part, id)}
        />
      ))}
      <Separator />
      <Heading>Visualise</Heading>
      <p className="text-xs leading-5 text-muted-foreground">
        Put a camera in the room, turn it to face what you want to see, and generate a picture from
        there.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const id = placeCamera(room)
          if (id) pick({ kind: 'object', id })
        }}
      >
        <CameraIcon />
        Visualise
      </Button>
    </>
  )
}

function wornAs(worn: string | undefined): Choice | undefined {
  if (worn === undefined) return undefined
  if (isColour(worn)) return { id: worn, label: worn.toUpperCase(), colour: worn }
  return finishOf(worn)
}
