import { CompassIcon } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useView, viewStore } from '../store/view'

const TICKS = Array.from({ length: 24 }, (_, index) => index * 15)
const RING = 62
const NEAR = 4

const round = (spin: number) => {
  const nearest = (Math.round(spin / 15) * 15) % 360
  const apart = Math.abs(((spin - nearest + 540) % 360) - 180)
  return apart < NEAR ? nearest : spin
}

const nearestTick = (spin: number) => (Math.round(spin / 15) * 15) % 360

export function Compass() {
  const spin = useView((state) => state.spin)
  const dial = useRef<SVGSVGElement>(null)

  const turnTo = (event: { clientX: number; clientY: number }) => {
    const box = dial.current?.getBoundingClientRect()
    if (!box) return
    const dx = event.clientX - (box.left + box.width / 2)
    const dy = event.clientY - (box.top + box.height / 2)
    if (Math.hypot(dx, dy) < 8) return
    const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI
    viewStore.getState().spinTo(round((degrees + 360) % 360))
  }

  const marked = nearestTick(spin)
  const showing = Math.round(spin)

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Turn the plan"
              className="glass pointer-events-auto size-10 rounded-xl border"
              style={{ color: spin === 0 ? undefined : 'var(--primary)' }}
            >
              <CompassIcon style={{ transform: `rotate(${spin}deg)` }} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">Turn the plan</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" side="left" className="w-auto">
        <div className="flex flex-col items-center gap-2">
          <svg
            ref={dial}
            width={168}
            height={168}
            viewBox="-84 -84 168 168"
            aria-label="Angle"
            className="cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              turnTo(event)
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) turnTo(event)
            }}
          >
            <title>Angle</title>
            <circle r={RING + 10} fill="var(--card)" stroke="var(--border)" />
            {TICKS.map((tick) => {
              const on = tick === marked
              const long = on || tick % 90 === 0 ? 12 : 7
              const radians = (tick * Math.PI) / 180
              const sin = Math.sin(radians)
              const cos = Math.cos(radians)
              return (
                <line
                  key={tick}
                  x1={sin * RING}
                  y1={-cos * RING}
                  x2={sin * (RING - long)}
                  y2={-cos * (RING - long)}
                  stroke={on ? 'var(--primary)' : 'var(--muted-foreground)'}
                  strokeWidth={on || tick % 90 === 0 ? 2.5 : 1}
                  opacity={on || tick % 90 === 0 ? 1 : 0.45}
                />
              )
            })}
            <line
              x1={0}
              y1={0}
              x2={Math.sin((spin * Math.PI) / 180) * (RING - 14)}
              y2={-Math.cos((spin * Math.PI) / 180) * (RING - 14)}
              stroke="var(--primary)"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle r={3.5} fill="var(--primary)" />
            <text
              x={0}
              y={30}
              textAnchor="middle"
              fontSize={20}
              fill="var(--foreground)"
              fontWeight={600}
            >
              {showing}°
            </text>
          </svg>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={spin === 0}
            onClick={() => viewStore.getState().spinTo(0)}
          >
            North up
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
