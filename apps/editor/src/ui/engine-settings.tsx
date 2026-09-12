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
        <Label htmlFor="native-snap">Přichytávání</Label>
        <Switch
          id="native-snap"
          checked={settings.snap}
          onCheckedChange={(snap) => settings.configure({ snap })}
        />
      </div>
      <Label htmlFor="native-measure">Ruční měření</Label>
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
          <SelectItem value="none">Vypnuto</SelectItem>
          <SelectItem value="length">Mezi dvěma body</SelectItem>
          <SelectItem value="edge">Délka hrany</SelectItem>
        </SelectContent>
      </Select>
      {settings.measure !== 'none' ? (
        <p className="text-xs text-muted-foreground">
          Dvojklik určí bod měření. Escape měření ukončí.
        </p>
      ) : null}
      <Button variant="outline" size="sm" onClick={settings.clearMeasurements}>
        Smazat ruční měření
      </Button>
      <Label htmlFor="native-view">Pohled</Label>
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
          <SelectItem value="plan">Půdorys</SelectItem>
          <SelectItem value="floor-cut">Řez podlažím</SelectItem>
          <SelectItem value="section-x">Svislý řez X</SelectItem>
          <SelectItem value="section-y">Svislý řez Y</SelectItem>
        </SelectContent>
      </Select>
      {settings.view === 'section-x' || settings.view === 'section-y' ? (
        <>
          <Label htmlFor="section-offset">Posun řezu (m)</Label>
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
      <Label htmlFor="room-cut-height">Výška řezu nad podlažím (m)</Label>
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
      <p className="text-xs text-muted-foreground">Použije se pro pohled Řez podlažím.</p>
    </div>
  )
}
