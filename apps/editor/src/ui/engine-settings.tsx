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
import {
  type EngineTool,
  type EngineView,
  engineViewStore,
  useEngineView,
} from '../store/engine-view'
import { selectionStore, useSelection } from '../store/selection'
import { toolStore } from '../store/tool'

export function EngineSettings() {
  const state = useEngineView((s) => s)
  const measured = useSelection((s) => s.measured)
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="native-snap">Přichytávání</Label>
        <Switch id="native-snap" checked={state.snap} onCheckedChange={state.setSnap} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="native-dimensions">Kóty</Label>
        <Select
          value={measured}
          onValueChange={(value) =>
            selectionStore.getState().measure(value as 'none' | 'selected' | 'all')
          }
        >
          <SelectTrigger id="native-dimensions">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Skrýt</SelectItem>
            <SelectItem value="selected">Vybraná místnost</SelectItem>
            <SelectItem value="all">Všechny místnosti</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="native-measure">Ruční měření</Label>
        <Select
          value={state.tool}
          onValueChange={(value) => {
            toolStore.getState().arm(null)
            state.setTool(value as EngineTool)
          }}
        >
          <SelectTrigger id="native-measure">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="select">Vypnuto</SelectItem>
            <SelectItem value="length">Mezi dvěma body</SelectItem>
            <SelectItem value="edge">Délka hrany</SelectItem>
          </SelectContent>
        </Select>
        {state.tool !== 'select' && (
          <p className="text-xs text-muted-foreground">
            Dvojklik vybere bod nebo hranu. Esc ukončí měření.
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={state.clear}>
          Smazat ruční měření
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="native-view">Pohled a řezy</Label>
        <Select value={state.view} onValueChange={(value) => state.setView(value as EngineView)}>
          <SelectTrigger id="native-view">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plan">Půdorys podlaží</SelectItem>
            <SelectItem value="3d">3D model</SelectItem>
            <SelectItem value="section-x">Řez X</SelectItem>
            <SelectItem value="section-y">Řez Y</SelectItem>
          </SelectContent>
        </Select>
        {state.view.startsWith('section') && (
          <>
            <Label htmlFor="native-section">Posun řezu (m)</Label>
            <Input
              id="native-section"
              type="number"
              step="0.1"
              value={state.sectionOffset}
              onChange={(event) => {
                const n = event.target.valueAsNumber
                if (Number.isFinite(n)) state.setSectionOffset(n)
              }}
            />
          </>
        )}
      </div>
    </>
  )
}

export function RoomViewSettings() {
  const height = useEngineView((s) => s.cutHeight)
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="room-cut-height">Výška půdorysného řezu (m)</Label>
      <Input
        id="room-cut-height"
        type="number"
        min="0.05"
        step="0.1"
        value={height}
        onChange={(event) => {
          const n = event.target.valueAsNumber
          if (Number.isFinite(n) && n >= 0.05) engineViewStore.getState().setCutHeight(n)
        }}
      />
      <p className="text-xs text-muted-foreground">
        Nad podlahou aktuálního podlaží. Platí pro celý půdorysný pohled.
      </p>
    </div>
  )
}
