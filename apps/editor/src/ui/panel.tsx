import { CAMERA } from '@houseit/core/object-types'
import { roomsOf } from '@houseit/geometry/rooms'
import { useSelection } from '../store/selection'
import { useDocument } from '../store/store'
import { CameraPanel } from './panels/camera-panel'
import { ObjectPanel } from './panels/object-panel'
import { OpeningPanel } from './panels/opening-panel'
import { RoomPanel } from './panels/room-panel'
import { WallPanel } from './panels/wall-panel'

export function PanelContent() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const selected = useSelection((state) => state.selected)

  if (!selected) {
    return (
      <p className="text-xs leading-5 text-muted-foreground">
        Pick a room, a thing, a door or a wall to see it here. Drag things and openings to move
        them, drag a wall across itself; R turns, Delete removes, ⌘Z undoes.
      </p>
    )
  }

  if (selected.kind === 'room') {
    const room = roomsOf(doc, level).find((candidate) => candidate.id === selected.id)
    return room ? <RoomPanel room={room} /> : null
  }
  if (selected.kind === 'object') {
    const object = doc.objects[selected.id]
    if (!object) return null
    return object.type === CAMERA ? (
      <CameraPanel object={object} />
    ) : (
      <ObjectPanel object={object} />
    )
  }
  if (selected.kind === 'opening') {
    const opening = doc.openings[selected.id]
    return opening ? <OpeningPanel opening={opening} /> : null
  }
  const wall = doc.walls[selected.id]
  return wall ? <WallPanel wall={wall} /> : null
}
