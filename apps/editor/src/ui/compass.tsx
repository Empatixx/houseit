import { CompassIcon } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useView, viewStore } from '../store/view'

const TICKS = Array.from({ length: 24 }, (_, index) => index * 15)
const RING = 62
const TICK = 7
const MARK = 17
const NEAR = 4

const round = (spin: number) => {
  const nearest = (Math.round(spin / 15) * 15) % 360
  const apart = Math.abs(((spin - nearest + 540) % 360) - 180)
  return apart < NEAR ? nearest : spin
}

const corner = (spin: number, radius: number) => {
  const radians = (spin * Math.PI) / 180
  return { x: Math.sin(radians) * radius, y: -Math.cos(radians) * radius }
}

const spoke = (spin: number, reach: number) => {
  const from = corner(spin, RING)
  const to = corner(spin, RING - reach)
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
}

const sweep = (spin: number, radius: number) => {
  const to = corner(spin, radius)
  return `M 0 ${-radius} A ${radius} ${radius} 0 ${spin > 180 ? 1 : 0} 1 ${to.x} ${to.y}`
}

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
            <circle r={RING + 12} fill="var(--card)" stroke="var(--border)" />
            <circle
              r={RING}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              opacity={0.25}
            />
            {TICKS.map((tick) => (
              <line
                key={tick}
                {...spoke(tick, TICK)}
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                opacity={0.45}
              />
            ))}
            {spin === 0 ? null : (
              <path
                d={sweep(spin, RING)}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={4}
                strokeLinecap="round"
              />
            )}
            <line {...spoke(0, MARK)} stroke="var(--primary)" strokeWidth={3.5} />
            {spin === 0 ? null : (
              <line {...spoke(spin, MARK)} stroke="var(--primary)" strokeWidth={3.5} />
            )}
            <line
              x1={0}
              y1={0}
              x2={corner(spin, RING - MARK - 4).x}
              y2={corner(spin, RING - MARK - 4).y}
              stroke="var(--primary)"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.55}
            />
            <circle r={3.5} fill="var(--primary)" />
            <text
              x={0}
              y={32}
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
