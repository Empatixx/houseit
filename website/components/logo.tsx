export const BASE_PATH = '/houseit'

export function Logo({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="houseit: the outline of a house with a door swinging open"
    >
      <path
        d="M16 3.5 29 14.3V26.5a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 26.5V14.3Z"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path d="M11 29V17.5h11" stroke="var(--color-fd-primary)" strokeWidth="2" />
      <path
        d="M16.5 29v-6.5a6.5 6.5 0 0 1 6.5 6.5"
        stroke="var(--color-fd-primary)"
        strokeWidth="1.9"
      />
    </svg>
  )
}
