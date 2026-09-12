import type { HouseDocument } from '@houseit/core/document'
import { roomDimensions } from '@houseit/geometry/dimensions'
import { roomsOf } from '@houseit/geometry/rooms'
import { type LengthMeasurement, Line } from '@thatopen/components-front'
import { Vector3 } from 'three'
import { selectionStore } from '../store/selection'

export class NativeDimensions {
  private lines: Line[] = []
  constructor(private measurement: LengthMeasurement) {}
  clearManual() {
    for (const line of [...this.measurement.list])
      if (!this.lines.includes(line)) this.measurement.list.delete(line)
  }
  update(doc: HouseDocument, level: string, visible: boolean) {
    for (const line of this.lines) this.measurement.list.delete(line)
    this.lines = []
    const { measured, selected } = selectionStore.getState()
    if (!visible || measured === 'none' || !doc.levels[level]) return
    const roomId =
      selected?.kind === 'room'
        ? selected.id
        : selected?.kind === 'object'
          ? doc.objects[selected.id]?.room
          : undefined
    const height = doc.levels[level]!.elevation / 1000 + 0.05
    for (const room of roomsOf(doc, level)) {
      if (measured === 'selected' && room.id !== roomId) continue
      for (const dimension of roomDimensions(doc, level, room)) {
        const line = new Line(
          new Vector3(dimension.from.x / 1000, height, -dimension.from.y / 1000),
          new Vector3(dimension.to.x / 1000, height, -dimension.to.y / 1000),
        )
        this.lines.push(line)
        this.measurement.list.add(line)
      }
    }
  }
}
