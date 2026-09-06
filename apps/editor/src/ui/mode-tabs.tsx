import { BoxIcon, Grid2x2Icon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Mode, modeStore, useMode } from '../store/mode'

export function ModeTabs() {
  const mode = useMode((state) => state.mode)
  return (
    <div className="glass pointer-events-auto absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-xl border p-1">
      <Tabs value={mode} onValueChange={(value) => modeStore.getState().setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="2d" aria-label="Plan from above">
            <Grid2x2Icon />
            2D
          </TabsTrigger>
          <TabsTrigger value="3d" aria-label="Walk through">
            <BoxIcon />
            3D
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
