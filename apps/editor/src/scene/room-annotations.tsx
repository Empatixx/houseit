import { roomsOf } from '@houseit/geometry/rooms'
import { Html } from '@react-three/drei'
import { useDocument } from '../store/store'
import { toWorld } from './plan-coordinates'

const squareMetres = (area: number) => (area / 1_000_000).toFixed(1)

/**
 * Room names and areas are DOM, not geometry. Text that stays crisp and unscaled
 * at any zoom is a line of HTML and a shader's worth of work in WebGL.
 */
export function RoomAnnotations() {
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)

  return (
    <>
      {roomsOf(doc, level).map((room) => (
        <Html
          key={room.nodes.join('-')}
          position={toWorld(room.centre.x, room.centre.y)}
          center
          // The wrapper too, not only the text: a label that takes the pointer
          // takes the click meant for the room under it.
          style={{ pointerEvents: 'none' }}
        >
          <div className="pointer-events-none select-none whitespace-nowrap text-center leading-tight">
            <div className="text-sm font-medium text-neutral-900">{room.name ?? 'unnamed'}</div>
            <div className="text-xs text-neutral-500">{squareMetres(room.area)} m²</div>
          </div>
        </Html>
      ))}
    </>
  )
}
