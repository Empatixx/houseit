import type { HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import type { World } from '@thatopen/components'
import { Mark } from '@thatopen/components-front'

export class NativeLabels {
  private labels: Mark[] = []
  constructor(private world: World) {}
  update(doc: HouseDocument, level: string, visible: boolean) {
    this.dispose()
    if (!visible || !doc.levels[level]) return
    for (const room of roomsOf(doc, level)) {
      if (!room.name) continue
      const element = document.createElement('div')
      element.className =
        'pointer-events-none rounded-md bg-white/85 px-2 py-1 text-center text-xs text-slate-700 shadow-sm'
      const name = document.createElement('strong'),
        area = document.createElement('div')
      name.textContent = room.name
      area.textContent = `${(room.clear / 1e6).toFixed(1)} m²`
      element.append(name, area)
      const label = new Mark(this.world, element)
      label.three.position.set(
        room.centre.x / 1000,
        doc.levels[level]!.elevation / 1000 + 0.03,
        -room.centre.y / 1000,
      )
      this.labels.push(label)
    }
  }
  dispose() {
    for (const label of this.labels) label.dispose()
    this.labels = []
  }
}
