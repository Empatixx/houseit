import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { type EngineView, engineViewStore, useEngineView } from '../store/engine-view'
import { modeStore } from '../store/mode'

export function EngineSettings() {
  const settings = useEngineView((state) => state)
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="native-snap">Snapping</Label>
        <Switch
          id="native-snap"
          checked={settings.snap}
          onCheckedChange={(snap) => settings.configure({ snap })}
        />
      </div>
      <Label htmlFor="native-measure">Manual measurement</Label>
      <Select
        value={settings.measure}
        onValueChange={(measure) =>
          settings.configure({ measure: measure as typeof settings.measure })
        }
      >
        <SelectTrigger id="native-measure" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Off</SelectItem>
          <SelectItem value="length">Between two points</SelectItem>
          <SelectItem value="edge">Edge length</SelectItem>
        </SelectContent>
      </Select>
      {settings.measure !== 'none' ? (
        <p className="text-xs text-muted-foreground">
          Double-click places a measuring point. Escape ends the measurement.
        </p>
      ) : null}
      <Button variant="outline" size="sm" onClick={settings.clearMeasurements}>
        Clear manual measurements
      </Button>
      <Label htmlFor="native-view">View</Label>
      <Select
        value={settings.view}
        onValueChange={(view) => {
          settings.configure({ view: view as EngineView })
          modeStore.getState().setMode('2d')
        }}
      >
        <SelectTrigger id="native-view" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="plan">Plan</SelectItem>
          <SelectItem value="floor-cut">Floor cut</SelectItem>
          <SelectItem value="section-x">Vertical section X</SelectItem>
          <SelectItem value="section-y">Vertical section Y</SelectItem>
        </SelectContent>
      </Select>
      {settings.view === 'section-x' || settings.view === 'section-y' ? (
        <>
          <Label htmlFor="section-offset">Section offset (m)</Label>
          <Input
            id="section-offset"
            type="number"
            step="0.1"
            value={settings.offset}
            onChange={(e) => {
              const offset = e.target.valueAsNumber
              if (Number.isFinite(offset)) settings.configure({ offset })
            }}
          />
        </>
      ) : null}
    </>
  )
}
export function RoomViewSettings() {
  const height = useEngineView((state) => state.cutHeight)
  return (
    <div className="space-y-2">
      <Label htmlFor="room-cut-height">Cut height above floor (m)</Label>
      <Input
        id="room-cut-height"
        type="number"
        min="0.05"
        step="0.1"
        value={height}
        onChange={(e) => {
          const cutHeight = e.target.valueAsNumber
          if (Number.isFinite(cutHeight) && cutHeight >= 0.05)
            engineViewStore.getState().configure({ cutHeight })
        }}
      />
      <p className="text-xs text-muted-foreground">Used by the Floor cut view.</p>
    </div>
  )
}
