import type { Outline } from '@/store/projects/outline'

/**
 * A project's plan, small: its walls as lines, nothing else.
 *
 * The plan's y goes up the screen and an SVG's goes down it, so the whole
 * drawing is flipped rather than every line being worked out backwards. Widths
 * are in millimetres like everything else, which is what keeps a large flat and
 * a single room looking like the same drawing at two sizes.
 */
export function PlanOutline({ outline }: { outline?: Outline }) {
  if (!outline || outline.segments.length === 0) {
    return <div className="size-full" />
  }

  const across = Math.max(outline.width, outline.height, 1)
  const margin = across * 0.08

  return (
    <svg
      viewBox={`${-margin} ${-margin} ${outline.width + margin * 2} ${outline.height + margin * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="size-full text-foreground/55"
      aria-hidden="true"
    >
      <g
        transform={`translate(0 ${outline.height}) scale(1 -1)`}
        stroke="currentColor"
        strokeWidth={across / 90}
        strokeLinecap="round"
      >
        {outline.segments.map(([x0, y0, x1, y1]) => (
          <line key={`${x0},${y0},${x1},${y1}`} x1={x0} y1={y0} x2={x1} y2={y1} />
        ))}
      </g>
    </svg>
  )
}
