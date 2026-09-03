import { BoxIcon, Grid2x2Icon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Mode, modeStore, useMode } from '../store/mode'

/**
 * The card over the plan's top left corner: the plan from above, or walked
 * through. Two tabs, because the two are two ways of looking at one plan,
 * not two plans.
 */
export function ModeTabs() {
  const mode = useMode((state) => state.mode)
  return (
    <div className="pointer-events-none absolute top-3 left-3">
      <div className="pointer-events-auto rounded-xl border bg-card p-1 shadow-md">
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
    </div>
  )
}
