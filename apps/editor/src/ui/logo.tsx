/**
 * The mark: a house, as the plan draws one — a roof line over a room, in the
 * blue the plan picks things out in. Inline, so it needs no file and takes the
 * text colour round it for its walls.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <title>houseit</title>
      <path
        d="M3.5 11.5 12 4l8.5 7.5"
        stroke="#2f6fed"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10.2V20h12v-9.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
